from middleware import token_required
from flask import Blueprint,jsonify,request
from db import db
import io
import json
from PyPDF2 import PdfReader
from models import Chat
import uuid
from utils import RestaurantHandle,parse_reasoning_response
from service import OpenAiService

chats_bp = Blueprint('chats',__name__)

"""explain: Creates a new chat session for the authenticated user."""
@chats_bp.route('/api/chats', methods=['POST'])
@token_required
def create_chat():
    chat_id = str(uuid.uuid4())
    # Generate a default name, maybe based on timestamp or a generic counter if needed
    default_name = f"New Chat {chat_id[:4]}"
    chat = Chat(
        id=chat_id,
        user_id=request.user.id,
        name=default_name,
        messages='[]',
        pdf_text='',
        uploaded_pdfs='[]'
    )
    try:
        db.session.add(chat)
        db.session.commit()
        # Return the full chat object including the generated name
        return jsonify({"id": chat.id, "name": chat.name}), 201
    except Exception as e:
         db.session.rollback()
         print(f"DB error creating chat: {e}")
         return jsonify({"error": "Database error creating chat"}), 500
    
"""explain: Retrieves the list of chat sessions (ID and name) for the authenticated user."""
@chats_bp.route('/api/chats', methods=['GET'])
@token_required
def get_chats():
    try:
        # Order chats by creation time or last updated time if available
        # Assuming newer chats are more relevant, order descending by ID (if UUIDs are sequential enough) or add a timestamp column
        chats = Chat.query.filter_by(user_id=request.user.id).order_by(Chat.id.desc()).all()
        # Return basic info: id and name
        return jsonify([{"id": chat.id, "name": chat.name or f"Chat {chat.id[:4]}"} for chat in chats])
    except Exception as e:
        print(f"Error fetching chats: {e}")
        return jsonify({"error": "Error retrieving chat list"}), 500

"""explain: Handles GET (retrieve details), PUT (rename), and DELETE operations for a specific chat."""

@chats_bp.route('/api/chats/<chat_id>', methods=['GET', 'PUT', 'DELETE'])
@token_required
def manage_chat(chat_id):
    # Fetch the specific chat belonging to the user
    chat = Chat.query.filter_by(id=chat_id, user_id=request.user.id).first()
    if not chat:
        return jsonify({"error": "Chat not found or access denied"}), 404

    if request.method == 'GET':
        try:
            messages_list = json.loads(chat.messages or '[]')
            pdfs_list = json.loads(chat.uploaded_pdfs or '[]')

            # --- Ensure messages have the correct structure for frontend ---
            # Add empty reasoning if missing for older messages or non-reasoning responses
            updated_messages = []
            for msg in messages_list:
                if msg.get('role') == 'assistant' and 'reasoning' not in msg:
                    msg['reasoning'] = None # Add null/None reasoning field
                updated_messages.append(msg)

            return jsonify({
                "id": chat.id,
                "name": chat.name or f"Chat {chat.id[:4]}",
                "messages": updated_messages, # Return potentially modified messages
                "pdf_text": chat.pdf_text or "",
                "uploaded_pdfs": pdfs_list
            })
        except json.JSONDecodeError:
             return jsonify({"error": "Error decoding chat data"}), 500
        except Exception as e:
            print(f"Error fetching chat details: {e}")
            return jsonify({"error": "Internal server error fetching chat details"}), 500

    elif request.method == 'PUT': # Rename chat
        data = request.get_json()
        if not data or 'name' not in data:
            return jsonify({"error": "New name is required"}), 400
        new_name = data['name'].strip()
        if not new_name:
             return jsonify({"error": "Chat name cannot be empty"}), 400
        # Optional: Add length validation for the name
        max_name_length = 100
        if len(new_name) > max_name_length:
             return jsonify({"error": f"Chat name cannot exceed {max_name_length} characters"}), 400

        chat.name = new_name
        try:
            db.session.commit()
            return jsonify({"success": True, "message": "Chat renamed successfully"})
        except Exception as e:
             db.session.rollback()
             print(f"DB error renaming chat: {e}")
             return jsonify({"error": "Database error renaming chat"}), 500

    elif request.method == 'DELETE':
        try:
            db.session.delete(chat)
            db.session.commit()
            return jsonify({"success": True, "message": "Chat deleted successfully"})
        except Exception as e:
             db.session.rollback()
             print(f"DB error deleting chat: {e}")
             return jsonify({"error": "Database error deleting chat"}), 500

"""explain: Handles uploading of PDF files, extracts text, and appends it to the chat's context."""

@chats_bp.route('/api/chats/<chat_id>/upload-pdfs', methods=['POST'])
@token_required
def upload_pdfs(chat_id):
    chat = Chat.query.filter_by(id=chat_id, user_id=request.user.id).first()
    if not chat:
        return jsonify({"error": "Chat not found or access denied"}), 404

    if 'pdfs' not in request.files:
        return jsonify({"error": "No PDF files found in request"}), 400

    pdf_files = request.files.getlist('pdfs')
    if not pdf_files:
         return jsonify({"error": "No PDF files selected"}), 400

    current_pdf_text = chat.pdf_text or ""
    current_uploaded_pdfs = json.loads(chat.uploaded_pdfs or '[]')
    newly_uploaded_filenames = []
    errors = []

    for pdf_file in pdf_files:
        if pdf_file and pdf_file.filename and pdf_file.filename.lower().endswith('.pdf'):
            filename = pdf_file.filename

            if filename in current_uploaded_pdfs:
                 errors.append(f"'{filename}' is already uploaded to this chat.")
                 continue

            try:
                pdf_stream = io.BytesIO(pdf_file.read())
                pdf_reader = PdfReader(pdf_stream)
                extracted_text = ""
                for page in pdf_reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        extracted_text += page_text + "\n\n"

                if extracted_text:
                     current_pdf_text += f"--- START OF {filename} ---\n{extracted_text}\n--- END OF {filename} ---\n\n"
                     current_uploaded_pdfs.append(filename)
                     newly_uploaded_filenames.append(filename)
                else:
                     errors.append(f"Could not extract text from '{filename}'.")

            except Exception as e:
                errors.append(f"Error processing PDF '{filename}': {str(e)}")
        else:
            if pdf_file.filename:
                 errors.append(f"Invalid file type for '{pdf_file.filename}'. Only PDFs are allowed.")

    if newly_uploaded_filenames:
        chat.pdf_text = current_pdf_text
        chat.uploaded_pdfs = json.dumps(current_uploaded_pdfs)
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"DB error saving uploaded PDF data: {e}")
            all_errors = errors + ["Database error saving changes."]
            return jsonify({"error": ", ".join(all_errors)}), 500

    if not errors:
        return jsonify({"message": "PDFs uploaded successfully.", "uploaded_pdfs": current_uploaded_pdfs})
    else:
         return jsonify({
             "message": f"Processed uploads with some issues. Newly added: {', '.join(newly_uploaded_filenames) if newly_uploaded_filenames else 'None'}.",
             "errors": errors,
             "uploaded_pdfs": current_uploaded_pdfs
         }), 207

"""explain: Removes a specific PDF's filename from the list and its corresponding text content from the chat context."""

@chats_bp.route('/api/chats/<chat_id>/remove-pdf', methods=['POST'])
@token_required
def remove_pdf(chat_id):
    chat = Chat.query.filter_by(id=chat_id, user_id=request.user.id).first()
    if not chat:
        return jsonify({"error": "Chat not found or access denied"}), 404

    data = request.get_json()
    if not data or 'pdf_name' not in data:
        return jsonify({"error": "PDF name is required"}), 400
    pdf_name_to_remove = data['pdf_name']

    try:
        uploaded_pdfs = json.loads(chat.uploaded_pdfs or '[]')
        if pdf_name_to_remove not in uploaded_pdfs:
            return jsonify({"error": f"PDF '{pdf_name_to_remove}' not found in this chat"}), 404

        uploaded_pdfs.remove(pdf_name_to_remove)

        current_pdf_text = chat.pdf_text or ""
        start_marker = f"--- START OF {pdf_name_to_remove} ---"
        end_marker = f"--- END OF {pdf_name_to_remove} ---"
        start_index = current_pdf_text.find(start_marker)
        end_index = current_pdf_text.find(end_marker)

        new_pdf_text = current_pdf_text
        if start_index != -1 and end_index != -1:
            end_marker_line_end = current_pdf_text.find("\n", end_index + len(end_marker))
            if end_marker_line_end != -1:
                 new_pdf_text = current_pdf_text[:start_index] + current_pdf_text[end_marker_line_end:].lstrip("\n")
            else:
                 new_pdf_text = current_pdf_text[:start_index]
        else:
             print(f"Warning: Markers for '{pdf_name_to_remove}' not found in pdf_text. Text content not removed.")


        chat.uploaded_pdfs = json.dumps(uploaded_pdfs)
        chat.pdf_text = new_pdf_text.strip()

        db.session.commit()
        return jsonify({"success": True, "message": f"PDF '{pdf_name_to_remove}' removed."})

    except json.JSONDecodeError:
        return jsonify({"error": "Error decoding PDF list data"}), 500
    except Exception as e:
        db.session.rollback()
        print(f"DB error removing PDF: {e}")
        return jsonify({"error": "Database error removing PDF"}), 500

"""explain: Processes incoming user messages, interacts with OpenAI (handling normal, food, and reasoning flows with structured output), and saves the conversation."""
@chats_bp.route('/api/chats/<chat_id>/messages', methods=['POST'])
@token_required
def send_message(chat_id):
    chat = Chat.query.filter_by(id=chat_id, user_id=request.user.id).first()
    if not chat:
        return jsonify({"error": "Chat not found or access denied"}), 404

    message = request.form.get("message")
    use_reasoning_flag = request.form.get("use_reasoning", "false").lower() == "true"

    if not message or not message.strip():
        return jsonify({"error": "Message cannot be empty"}), 400

    message = message.strip()

    try:
        messages = json.loads(chat.messages or '[]')
        pdf_text = chat.pdf_text or ""
    except json.JSONDecodeError:
        return jsonify({"error": "Error decoding existing messages"}), 500

    base_system_message = (
        "You are Merlin, a helpful AI assistant. Provide detailed, accurate, and relevant responses. "
        "Be concise when appropriate but comprehensive when needed. "
        "If the user asks about coding, provide clear code examples using markdown code blocks. "
        "For HTML snippets, use ```html ... ```. For Python, use ```python ... ```, etc. "
        "Structure your answers clearly using paragraphs, lists, or other formatting as needed."
    )

    reasoning_instructions = (
        "\n\nIMPORTANT: Structure your response as follows:\n"
        "1. First, provide your step-by-step reasoning within <reasoning> tags. Explain how you interpret the request, relevant context (like documents), and how you arrive at the answer.\n"
        "2. After the reasoning, provide the final, direct answer to the user's query within <answer> tags.\n"
        "Example:\n<reasoning>\nThe user is asking about X based on the provided document Z. Document Z states Y. Therefore, the answer involves combining information about X and Y.\n</reasoning>\n<answer>\nBased on document Z, the details about X are Y.\n</answer>"
    )

    system_message = base_system_message
    if pdf_text:
        system_message += f"\n\nCONTEXT FROM UPLOADED DOCUMENTS:\n{pdf_text}"

    # Append reasoning instructions ONLY if reasoning mode is active
    if use_reasoning_flag:
        system_message += reasoning_instructions

    openai_model = "gpt-4o" # Default model
    if use_reasoning_flag:
        # Use gpt-4o-mini for the reasoning flow as requested
        openai_model = "gpt-4o"
        print(f"Reasoning mode active for chat {chat_id}. Using model: {openai_model}")
    else:
        print(f"Default mode active for chat {chat_id}. Using model: {openai_model}")


    is_restaurant_query = False
    if not use_reasoning_flag: # Check location/food only if not explicitly in reasoning mode
        restaurant_keywords = ['restaurant', 'eat', 'food', 'dinner', 'lunch', 'meal', 'cuisine', 'dining']
        intent_keywords = ['near me', 'find', 'where', 'suggest', 'recommend', 'looking for', 'want to eat', 'nearby', 'around here']
        lower_message = message.lower()
        is_restaurant_query = any(keyword in lower_message for keyword in restaurant_keywords) and \
                             any(intent in lower_message for intent in intent_keywords)

    user = request.user

    # --- Restaurant Flow ---
    if is_restaurant_query: # Only runs if not use_reasoning_flag
        print(f"Restaurant query detected for chat {chat_id}")
        if user.latitude is None or user.longitude is None:
            print("Location not available for food query.")
            response_text = "I can help with restaurant suggestions! Please share your location first by clicking the 'Share Location' button."
            messages.append({"role": "user", "content": message})
            # Store assistant message with null reasoning
            messages.append({"role": "assistant", "reasoning": None, "content": response_text})
            chat.messages = json.dumps(messages)
            try:
                 db.session.commit()
            except Exception as e:
                 db.session.rollback(); print(f"DB error saving location prompt: {e}")
            return jsonify({"reasoning": None, "response": response_text}) # Return structured response
        else:
            print(f"Location available: ({user.latitude}, {user.longitude}). Preparing food query.")
            restaurant_handle = RestaurantHandle()
            keywords = restaurant_handle.extract_food_keywords(message)
            restaurants = restaurant_handle.get_restaurants(user.latitude, user.longitude, keywords)
            formatted_restaurants = restaurant_handle.format_restaurants(restaurants)

            prompt = (
                f"User's location: ({user.latitude}, {user.longitude})\n"
                f"User's message: {message}\n"
                f"{formatted_restaurants}\n"
                "Task: Suggest one or more restaurants based on the user's preferences (or lack thereof). "
                "For each restaurant, provide the following details:\n"
                "1. Name of the restaurant\n"
                "2. Notable reason(s) to recommend it\n"
                "3. Address\n"
                f"4. Google Maps Link: Use this format: put the name of the restaurant as a link: https://www.google.com/maps/search/?api=1&query={user.latitude},{user.longitude}\n"
                "5. Google Maps: display an iframe of google map"
                "If preferences are unclear, suggest a variety of options and explain why each is a good choice. "
                "Ask follow-up questions if needed to clarify their food interests."
                
             )

            openai_api_messages = [
                {"role": "system", "content": base_system_message}, # Food query doesn't need reasoning tags
                {"role": "user", "content": prompt}
            ]

            try:
                open_ai_handler = OpenAiService()
                print("Sending food recommendation request to OpenAI...")
                response = open_ai_handler.getOpenAiClient().chat.completions.create(
                    model="gpt-4o", # Using gpt-4o for food recommendation
                    messages=openai_api_messages,
                    max_tokens=1024
                )
                ai_response_text = response.choices[0].message.content
                print("Received food recommendation response from OpenAI.")

                messages.append({"role": "user", "content": message})
                # Store food response with null reasoning
                messages.append({"role": "assistant", "reasoning": None, "content": ai_response_text})
                chat.messages = json.dumps(messages)
                db.session.commit()
                # Return structured response even for non-reasoning flow
                return jsonify({"reasoning": None, "response": ai_response_text})

            except Exception as e:
                 db.session.rollback()
                 print(f"Error during OpenAI call for food recommendation: {e}")
                 error_message = f"Sorry, I encountered an error while looking for restaurants: {str(e)}"
                 messages.append({"role": "user", "content": message})
                 messages.append({"role": "assistant", "reasoning": None, "content": error_message})
                 chat.messages = json.dumps(messages)
                 db.session.commit()
                 return jsonify({"reasoning": None, "response": error_message}), 500

    # --- Default or Reasoning Flow ---
    else:
        print(f"Proceeding with {openai_model} completion (Reasoning Mode: {use_reasoning_flag}).")

        openai_api_messages = [{"role": "system", "content": system_message}]
        # Append previous messages, adapting structure if needed
        for msg in messages:
            if isinstance(msg, dict) and 'role' in msg and 'content' in msg:
                # Send only the 'content' part to the API history
                 openai_api_messages.append({"role": msg["role"], "content": msg["content"]})
        openai_api_messages.append({"role": "user", "content": message})

        try:
            open_ai_handler = OpenAiService()
            response = open_ai_handler.getOpenAiClient().chat.completions.create(
                model=openai_model,
                messages=openai_api_messages,
                max_tokens=4096
            )
            ai_response_text = response.choices[0].message.content

            extracted_reasoning = None
            extracted_answer = ai_response_text # Default if not in reasoning mode or parsing fails

            # Parse only if reasoning was requested
            if use_reasoning_flag:
                extracted_reasoning, extracted_answer = parse_reasoning_response(ai_response_text)
                if extracted_reasoning is None:
                    print(f"Warning: Could not parse reasoning tags from {openai_model} response.")
                    # Keep the full response as the answer if parsing fails but reasoning was expected
                    extracted_answer = ai_response_text

            # Save history with the new structure
            messages.append({"role": "user", "content": message})
            messages.append({"role": "assistant", "reasoning": extracted_reasoning, "content": extracted_answer})
            chat.messages = json.dumps(messages) # Save updated history
            db.session.commit()

            # Return structured response
            return jsonify({"reasoning": extracted_reasoning, "response": extracted_answer})

        except Exception as e:
            db.session.rollback()
            print(f"Error during OpenAI call with model {openai_model}: {e}")
            error_message = f"Sorry, I encountered an error processing your request: {str(e)}"
            messages.append({"role": "user", "content": message})
            messages.append({"role": "assistant", "reasoning": None, "content": error_message}) # Save error with null reasoning
            chat.messages = json.dumps(messages)
            try:
                db.session.commit()
            except Exception as db_err:
                db.session.rollback()
                print(f"DB error saving error message: {db_err}")

            return jsonify({"reasoning": None, "response": error_message}), 500

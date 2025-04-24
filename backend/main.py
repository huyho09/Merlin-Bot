import os
import uuid
import json
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import io
from openai import OpenAI
from dotenv import load_dotenv
from PyPDF2 import PdfReader
import googlemaps # Add this import for Google Maps Places API
import urllib.parse # For URL encoding

load_dotenv()

app = Flask(__name__)

# Define allowed origins
# def get_allowed_origins():
#     return ['http://[::]:8000', 'http://localhost:8000']

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'theChosenOne')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///site.db') # Use DATABASE_URL if set
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024 # Limit uploads to 100MB total

# CORS(app, supports_credentials=True, origins=get_allowed_origins()) # Example with specific origins
CORS(app) # Allow all for development

db = SQLAlchemy(app)
migrate = Migrate(app, db)
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
gmaps_api_key = os.getenv("GOOGLE_API_KEY")
if not gmaps_api_key:
    print("Warning: GOOGLE_API_KEY not found in environment variables. Location features will be limited.")
    gmaps = None
else:
    gmaps = googlemaps.Client(key=gmaps_api_key)
GOOGLE_MAPS_API_KEY = gmaps_api_key


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(150), nullable=False)
    token = db.Column(db.String(36), unique=True, nullable=True, index=True) 
    latitude = db.Column(db.Float, nullable=True) 
    longitude = db.Column(db.Float, nullable=True) 

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Chat(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=True) 
    messages = db.Column(db.Text, default='[]') 
    pdf_text = db.Column(db.Text, default='') 
    uploaded_pdfs = db.Column(db.Text, default='[]') 

    user = db.relationship('User', backref=db.backref('chats', lazy=True))

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            # Check if token starts with "Bearer " and remove it
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]

        if not token:
            return jsonify({"error": "Authentication Token is missing!"}), 401
        try:
            # Ensure user exists for the given token
            user = User.query.filter_by(token=token).first()
            if not user:
                return jsonify({"error": "Invalid Authentication Token!"}), 401
            request.user = user # Attach user object to request context
        except Exception as e:
            print(f"Token validation error: {e}")
            return jsonify({"error": "Internal server error during token validation"}), 500

        return f(*args, **kwargs)
    return decorated

# Endpoint to update user location
@app.route('/api/users/location', methods=['PUT'])
@token_required
def update_user_location():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request must be JSON"}), 400

    latitude = data.get('latitude')
    longitude = data.get('longitude')

    # Allow null values to clear location
    if latitude is not None and longitude is None:
         return jsonify({"error": "Longitude must be provided if latitude is provided"}), 400
    if longitude is not None and latitude is None:
         return jsonify({"error": "Latitude must be provided if longitude is provided"}), 400
    # Validate coordinate types if not None
    if latitude is not None and not isinstance(latitude, (int, float)):
        return jsonify({"error": "Invalid latitude format"}), 400
    if longitude is not None and not isinstance(longitude, (int, float)):
        return jsonify({"error": "Invalid longitude format"}), 400


    user = request.user
    # Set to None if null was explicitly passed, otherwise keep the value
    user.latitude = latitude if latitude is not None else None
    user.longitude = longitude if longitude is not None else None

    try:
        db.session.commit()
        if latitude is not None and longitude is not None:
             message = "Location updated successfully"
        else:
             message = "Location removed successfully"
        return jsonify({"message": message}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error updating location in DB: {e}")
        return jsonify({"error": "Database error updating location"}), 500


# Helper function to fetch restaurants (requires googlemaps client)
def get_restaurants(latitude, longitude, keywords=None, radius=1000):
    if not gmaps: # Check if googlemaps client is initialized
        print("Google Maps client not available. Cannot fetch restaurants.")
        return []
    params = {
        'location': (latitude, longitude),
        'radius': radius,
        'type': 'restaurant'
    }
    if keywords:
        # Join keywords for the Places API query
        params['keyword'] = ' '.join(keywords)
    try:
        print(f"Querying Google Places API with params: {params}") # Debug log
        results = gmaps.places_nearby(**params)
        # print(f"Places API response: {results}") # Debug log (can be verbose)
        return results.get('results', [])
    except Exception as e:
        print(f"Error fetching restaurants from Google Maps API: {e}")
        return []

# Helper function to extract food keywords from a message
def extract_food_keywords(message):
    # Expanded list of common food types and cuisines
    food_types = [
        'italian', 'chinese', 'japanese', 'mexican', 'indian', 'american', 'french',
        'mediterranean', 'middle eastern', 'vietnamese', 'pho', 'thai', 'greek', 'spanish',
        'german', 'russian', 'african', 'caribbean', 'south american', 'korean', 'bbq',
        'pizza', 'burger', 'sandwiches', 'sushi', 'ramen', 'tapas', 'steak', 'seafood',
        'vegetarian', 'vegan', 'gluten-free', 'bakery', 'cafe', 'coffee', 'dessert', 'brunch'
    ]
    lower_message = message.lower()
    # Return keywords found in the message
    return [food for food in food_types if food in lower_message]

# Helper function to format restaurant data for LLM context
def format_restaurants(restaurants):
    if not restaurants:
        return "Context: No relevant restaurants found in the immediate vicinity based on the query.\n"
    # Limit context size to avoid overly long prompts
    context_limit = 3
    formatted = f"Context: Nearby Restaurants Found (Top {min(len(restaurants), context_limit)} relevant results):\n"
    for r in restaurants[:context_limit]:
        name = r.get('name', 'Unknown Name')
        rating = r.get('rating', 'N/A')
        vicinity = r.get('vicinity', 'Unknown location')
        lat = r.get('geometry', {}).get('location', {}).get('lat')
        lng = r.get('geometry', {}).get('location', {}).get('lng')
        place_id = r.get('place_id', None) # Get place_id if available

        formatted += f"- Name: {name}, Rating: {rating}, Address: {vicinity}"
        if lat and lng and GOOGLE_MAPS_API_KEY:
            # Prepare query for Maps URL and Embed API
            # Use place_id for better accuracy if available, otherwise fall back to name/address
            if place_id:
                query_param = f"query_place_id:{place_id}"
            else:
                query_param = f"query:{urllib.parse.quote(f'{name}, {vicinity}')}"

            # Generate Embed iframe URL (ensure API key is available)
            iframe_url = f"https://www.google.com/maps/embed/v1/place?key={GOOGLE_MAPS_API_KEY}&{query_param}"
            # Include iframe tag in the context provided to the LLM
            formatted += f"\n  MapEmbed: <iframe width='100%' height='300' frameborder='0' style='border:0' src='{iframe_url}' allowfullscreen></iframe>\n"
        else:
             formatted += "\n  (Map data incomplete or API key missing)\n"
        formatted += "\n" # Newline for separation

    return formatted


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({"error": "Username and password required"}), 400

    username = data.get('username')
    password = data.get('password')
    user = User.query.filter_by(username=username).first()

    if user and user.check_password(password):
        token = str(uuid.uuid4())
        user.token = token # Update user's token
        try:
            db.session.commit()
            return jsonify({"message": "Login successful", "token": token}), 200
        except Exception as e:
             db.session.rollback()
             print(f"DB error during login: {e}")
             return jsonify({"error": "Database error during login"}), 500
    else: # Invalid username or password
        return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/logout', methods=['POST'])
@token_required
def logout():
    user = request.user
    user.token = None # Invalidate the token
    try:
        db.session.commit()
        return jsonify({"message": "Logout successful"}), 200
    except Exception as e:
        db.session.rollback()
        print(f"DB error during logout: {e}")
        return jsonify({"error": "Database error during logout"}), 500

@app.route('/api/check-login', methods=['GET'])
def check_login():
    token = None
    if 'Authorization' in request.headers:
        auth_header = request.headers['Authorization']
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if token and User.query.filter_by(token=token).first():
        return jsonify({"logged_in": True}), 200
    else:
        # Return 401 if token is missing or invalid
        return jsonify({"logged_in": False, "error": "Invalid or missing token"}), 401

@app.route('/api/chats', methods=['POST'])
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


@app.route('/api/chats', methods=['GET'])
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


@app.route('/api/chats/<chat_id>', methods=['GET', 'PUT', 'DELETE'])
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
            return jsonify({
                "id": chat.id,
                "name": chat.name or f"Chat {chat.id[:4]}",
                "messages": messages_list,
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
            # Potentially delete associated files if stored separately
            # pdf_dir = os.path.join('uploads', str(request.user.id), chat_id)
            # if os.path.exists(pdf_dir):
            #     shutil.rmtree(pdf_dir) # Example if files were stored

            db.session.delete(chat)
            db.session.commit()
            return jsonify({"success": True, "message": "Chat deleted successfully"})
        except Exception as e:
             db.session.rollback()
             print(f"DB error deleting chat: {e}")
             return jsonify({"error": "Database error deleting chat"}), 500


@app.route('/api/chats/<chat_id>/upload-pdfs', methods=['POST'])
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
            # Sanitize filename (optional but recommended)
            # filename = secure_filename(pdf_file.filename)
            filename = pdf_file.filename # Use original for now

            if filename in current_uploaded_pdfs:
                 errors.append(f"'{filename}' is already uploaded to this chat.")
                 continue # Skip already uploaded file

            try:
                # Read PDF content directly from the stream
                pdf_stream = io.BytesIO(pdf_file.read())
                pdf_reader = PdfReader(pdf_stream)
                extracted_text = ""
                for page in pdf_reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        extracted_text += page_text + "\n\n" # Add separation between pages

                if extracted_text:
                     # Prepend filename as context marker
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
            # Ignore empty file parts

    # Update chat only if new PDFs were successfully processed
    if newly_uploaded_filenames:
        chat.pdf_text = current_pdf_text
        chat.uploaded_pdfs = json.dumps(current_uploaded_pdfs)
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"DB error saving uploaded PDF data: {e}")
            # Return combined errors
            all_errors = errors + ["Database error saving changes."]
            return jsonify({"error": ", ".join(all_errors)}), 500

    # Return status
    if not errors:
        return jsonify({"message": "PDFs uploaded successfully.", "uploaded_pdfs": current_uploaded_pdfs})
    else:
         # Return partial success with errors
         return jsonify({
             "message": f"Processed uploads with some issues. Newly added: {', '.join(newly_uploaded_filenames) if newly_uploaded_filenames else 'None'}.",
             "errors": errors,
             "uploaded_pdfs": current_uploaded_pdfs # Return the updated list even with errors
         }), 207 # Multi-Status response


# This endpoint might not be needed if pdf_text is returned with the chat details
# @app.route('/api/chats/<chat_id>/get-pdfs', methods=['GET'])
# @token_required
# def get_pdfs(chat_id):
#     chat = Chat.query.filter_by(id=chat_id, user_id=request.user.id).first()
#     if not chat:
#         return jsonify({"error": "Chat not found"}), 404
#     return jsonify({"pdf_text": chat.pdf_text or ""})


@app.route('/api/chats/<chat_id>/remove-pdf', methods=['POST'])
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

        # Remove from the list
        uploaded_pdfs.remove(pdf_name_to_remove)

        # Rebuild pdf_text excluding the removed PDF's content (more complex but accurate)
        # This requires markers in the text (like the START/END markers added during upload)
        current_pdf_text = chat.pdf_text or ""
        start_marker = f"--- START OF {pdf_name_to_remove} ---"
        end_marker = f"--- END OF {pdf_name_to_remove} ---"
        start_index = current_pdf_text.find(start_marker)
        end_index = current_pdf_text.find(end_marker)

        new_pdf_text = current_pdf_text
        if start_index != -1 and end_index != -1:
             # Find the end of the end_marker line
            end_marker_line_end = current_pdf_text.find("\n", end_index + len(end_marker))
            if end_marker_line_end != -1:
                 # Remove the section including markers and trailing newlines
                 new_pdf_text = current_pdf_text[:start_index] + current_pdf_text[end_marker_line_end:].lstrip("\n")
            else: # Handle case where end marker is at the very end
                 new_pdf_text = current_pdf_text[:start_index]
        else:
            # Fallback if markers aren't found (might happen with older data)
            # This won't remove the text, just the filename from the list
             print(f"Warning: Markers for '{pdf_name_to_remove}' not found in pdf_text. Text content not removed.")


        chat.uploaded_pdfs = json.dumps(uploaded_pdfs)
        chat.pdf_text = new_pdf_text.strip() # Update text and remove leading/trailing whitespace

        db.session.commit()
        return jsonify({"success": True, "message": f"PDF '{pdf_name_to_remove}' removed."})

    except json.JSONDecodeError:
        return jsonify({"error": "Error decoding PDF list data"}), 500
    except Exception as e:
        db.session.rollback()
        print(f"DB error removing PDF: {e}")
        return jsonify({"error": "Database error removing PDF"}), 500


@app.route('/api/chats/<chat_id>/messages', methods=['POST'])
@token_required
def send_message(chat_id):
    chat = Chat.query.filter_by(id=chat_id, user_id=request.user.id).first()
    if not chat:
        return jsonify({"error": "Chat not found or access denied"}), 404

    # Use request.form for FormData
    message = request.form.get("message")
    if not message or not message.strip():
        return jsonify({"error": "Message cannot be empty"}), 400

    message = message.strip() # Clean whitespace

    try:
        messages = json.loads(chat.messages or '[]')
        pdf_text = chat.pdf_text or "" # Get PDF text from the chat record
    except json.JSONDecodeError:
        return jsonify({"error": "Error decoding existing messages"}), 500

    # --- System Message Setup ---
    base_system_message = (
        "You are Merlin, a helpful AI assistant. Provide detailed, accurate, and relevant responses. "
        "Be concise when appropriate but comprehensive when needed. "
        "If the user asks about coding, provide clear code examples using markdown code blocks. "
        "For HTML snippets, use ```html ... ```. For Python, use ```python ... ```, etc. "
        "Structure your answers clearly using paragraphs, lists, or other formatting as needed."
    )
    # Add PDF context if available
    if pdf_text:
        system_message = f"{base_system_message}\n\nCONTEXT FROM UPLOADED DOCUMENTS:\n{pdf_text}"
    else:
        system_message = base_system_message

    # --- Restaurant Query Logic ---
    restaurant_keywords = ['restaurant', 'eat', 'food', 'dinner', 'lunch', 'meal', 'cuisine', 'dining']
    intent_keywords = ['near me', 'find', 'where', 'suggest', 'recommend', 'looking for', 'want to eat', 'nearby', 'around here']
    lower_message = message.lower()

    is_restaurant_query = any(keyword in lower_message for keyword in restaurant_keywords) and \
                         any(intent in lower_message for intent in intent_keywords)

    user = request.user # Get user associated with the token

    # Check if location is available AND needed for the query
    if is_restaurant_query:
        print(f"Restaurant query detected for chat {chat_id}") # Debug log
        # *** Explicitly check for None values ***
        if user.latitude is None or user.longitude is None:
            print("Location not available for food query.") # Debug log
            response_text = "I can help with restaurant suggestions! Please share your location first by clicking the 'Share Location' button."
            # Append user message and this specific response, then return
            messages.append({"role": "user", "content": message})
            messages.append({"role": "assistant", "content": response_text})
            chat.messages = json.dumps(messages)
            try:
                 db.session.commit()
            except Exception as e:
                 db.session.rollback(); print(f"DB error saving location prompt: {e}")
            return jsonify({"response": response_text}) # Return the prompt to share location
        else:
            # Location is available, proceed with food recommendation prompt
            print(f"Location available: ({user.latitude}, {user.longitude}). Preparing food query.") # Debug log
            keywords = extract_food_keywords(message)
            restaurants = get_restaurants(user.latitude, user.longitude, keywords)
            formatted_restaurants = format_restaurants(restaurants)

            # Construct the specific prompt for OpenAI
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
                {"role": "system", "content": base_system_message}, # Base instructions
                {"role": "user", "content": prompt} # Specific task with context
            ]

            try:
                print("Sending food recommendation request to OpenAI...") # Debug log
                response = openai_client.chat.completions.create(
                    model="gpt-4o", # Use your preferred model
                    messages=openai_api_messages,
                    max_tokens=1024 # Adjust as needed
                )
                ai_response = response.choices[0].message.content
                print("Received food recommendation response from OpenAI.") # Debug log

                # Save and return
                messages.append({"role": "user", "content": message}) # Append original user message
                messages.append({"role": "assistant", "content": ai_response})
                chat.messages = json.dumps(messages)
                db.session.commit()
                return jsonify({"response": ai_response})

            except Exception as e:
                 db.session.rollback()
                 print(f"Error during OpenAI call for food recommendation: {e}")
                 # Return a user-friendly error message
                 error_message = f"Sorry, I encountered an error while looking for restaurants: {str(e)}"
                 messages.append({"role": "user", "content": message})
                 messages.append({"role": "assistant", "content": error_message})
                 chat.messages = json.dumps(messages)
                 db.session.commit() # Save the error message
                 return jsonify({"response": error_message}), 500 # Indicate server error


    # --- Default Flow (Non-food queries) ---
    print("Proceeding with default OpenAI completion.") # Debug log

    # Construct message history for OpenAI, including the system message
    openai_api_messages = [{"role": "system", "content": system_message}]
    # Append previous messages (ensure they are in correct format)
    for msg in messages:
        if isinstance(msg, dict) and 'role' in msg and 'content' in msg:
             openai_api_messages.append({"role": msg["role"], "content": msg["content"]})
    openai_api_messages.append({"role": "user", "content": message}) # Add current user message

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o", # Use your preferred model
            messages=openai_api_messages,
            max_tokens=4096 # Adjust as needed
        )
        ai_response = response.choices[0].message.content
        # Append the user message and the final AI response to the history
        messages.append({"role": "user", "content": message})
        messages.append({"role": "assistant", "content": ai_response})
        chat.messages = json.dumps(messages) # Save updated history
        db.session.commit()
        return jsonify({"response": ai_response})
    except Exception as e:
        db.session.rollback()
        print(f"Error during default OpenAI call: {e}")
        # Return a user-friendly error
        error_message = f"Sorry, I encountered an error processing your request: {str(e)}"
        # Save the error message to the chat history? Optional.
        # messages.append({"role": "user", "content": message}) # Already appended before try block? Check logic.
        # messages.append({"role": "assistant", "content": error_message})
        # chat.messages = json.dumps(messages)
        # db.session.commit()
        return jsonify({"error": "Error generating response"}), 500


def init_db():
    with app.app_context():
        print("Initializing database...")
        try:
            db.create_all()
            # Check if default user exists, create if not
            if not User.query.filter_by(username='admin').first():
                print("Creating default admin user...")
                admin_password = os.getenv('ADMIN_PASSWORD', 'Password@123') # Use env var or default
                admin = User(username='admin')
                admin.set_password(admin_password)
                db.session.add(admin)
                db.session.commit()
                print("Default admin user created.")
            else:
                print("Admin user already exists.")
            print("Database initialized successfully.")
        except Exception as e:
            print(f"Error during database initialization: {e}")
            # Depending on the error, you might want to exit or handle differently
            # exit(1)


if __name__ == '__main__':
    if not os.getenv("OPENAI_API_KEY"):
        print("\033[91mError: OPENAI_API_KEY environment variable is not set.\033[0m") # Red color for error
        exit(1)
    if not gmaps_api_key: # Also warn about Google API Key
         print("\033[93mWarning: GOOGLE_API_KEY environment variable is not set. Location features will be limited.\033[0m") # Yellow for warning

    init_db() # Initialize DB schema and default user if needed
    port = int(os.getenv("PORT", 5001))
    debug_mode = os.getenv("FLASK_DEBUG", "False").lower() == "true" # Enable debug based on env var
    print(f"Starting Flask server on port {port} with debug mode: {debug_mode}")
    # Use 0.0.0.0 to be accessible externally, localhost for local only
    host = os.getenv("FLASK_HOST", "0.0.0.0")
    app.run(host=host, port=port, debug=debug_mode)

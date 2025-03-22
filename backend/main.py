from flask import Flask, jsonify, request
from flask_cors import CORS
import uuid
import os
import io
from openai import OpenAI
from dotenv import load_dotenv
from PyPDF2 import PdfReader

load_dotenv()

app = Flask(__name__)
CORS(app)  # Allow all origins

# In-memory (RAM) storage for chats need. TODO: create a DB to save
chats = {}

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@app.route('/api/chats', methods=['POST'])
def create_chat():
    chat_id = str(len(chats) + 1)
    chats[chat_id] = {'messages': [], 'pdf_text': '', 'uploaded_pdfs': []}
    return jsonify({"id": chat_id}), 201

@app.route('/api/chats', methods=['GET'])
def get_chats():
    return jsonify([{"id": chat_id} for chat_id in chats.keys()])

@app.route('/api/chats/<chat_id>', methods=['GET'])
def get_chat(chat_id):
    if chat_id not in chats:
        return jsonify({"error": "Chat not found"}), 404
    return jsonify({
        "messages": chats[chat_id]['messages'],
        "uploaded_pdfs": chats[chat_id].get('uploaded_pdfs', [])
    })

@app.route('/api/chats/<chat_id>/upload-pdfs', methods=['POST'])
def upload_pdfs(chat_id):
    if chat_id not in chats:
        return jsonify({"error": "Chat not found"}), 404
    
    if 'pdfs' not in request.files:
        return jsonify({"error": "No PDFs provided"}), 400
    
    pdf_files = request.files.getlist('pdfs')
    pdf_text = ""
    uploaded_pdfs = []
    for pdf_file in pdf_files:
        if pdf_file.filename == '':
            continue
        try:
            pdf_reader = PdfReader(io.BytesIO(pdf_file.read()))
            for page in pdf_reader.pages:
                pdf_text += page.extract_text() or ""
            uploaded_pdfs.append(pdf_file.filename)
        except Exception as e:
            return jsonify({"error": f"Error reading PDF: {str(e)}"}), 500
    
    # Overwrite existing pdf_text and uploaded_pdfs
    chats[chat_id]['pdf_text'] = pdf_text
    chats[chat_id]['uploaded_pdfs'] = uploaded_pdfs
    
    return jsonify({"uploaded_pdfs": uploaded_pdfs})

@app.route('/api/chats/<chat_id>/get-pdfs', methods=['GET'])
def get_pdfs(chat_id):
    if chat_id not in chats:
        return jsonify({"error": "Chat not found"}), 404
    return jsonify({"pdf_text": chats[chat_id].get('pdf_text', '')})

@app.route('/api/chats/<chat_id>/messages', methods=['POST'])
def send_message(chat_id):
    if chat_id not in chats:
        return jsonify({"error": "Chat not found"}), 404
    
    message = request.form.get("message")
    if not message:
        return jsonify({"error": "Message is required"}), 400
    
    pdf_text = request.form.get("pdf_text", "")
    
    openai_messages = []
    if pdf_text:
        openai_messages.append({"role": "system", "content": f"You have access to the following documents: {pdf_text}"})
    openai_messages.extend(chats[chat_id]['messages'])
    openai_messages.append({"role": "user", "content": message})
    
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=openai_messages,
            max_tokens=4096  # Maximum standard output limit
        )
        ai_response = response.choices[0].message.content
        chats[chat_id]['messages'].append({"role": "user", "content": message})
        chats[chat_id]['messages'].append({"role": "assistant", "content": ai_response})
        return jsonify({"response": ai_response})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    if not os.getenv("OPENAI_API_KEY"):
        print("Error: OPENAI_API_KEY environment variable is not set.")
        exit(1)
    port = int(os.getenv("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
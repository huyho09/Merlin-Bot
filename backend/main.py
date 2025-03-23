import os
import uuid
import json
from flask import Flask, jsonify, request
from flask_cors import CORS
import io
from openai import OpenAI
from dotenv import load_dotenv
from PyPDF2 import PdfReader
from pathlib import Path

load_dotenv()

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100 MB
CORS(app)  # Allow all origins

CHATS_DIR = Path('chats')
CHATS_DIR.mkdir(exist_ok=True)

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def get_chat_data(chat_id):
    chat_file = CHATS_DIR / f'{chat_id}.json'
    if not chat_file.exists():
        return None
    with open(chat_file, 'r') as f:
        return json.load(f)

def save_chat_data(chat_id, data):
    chat_file = CHATS_DIR / f'{chat_id}.json'
    with open(chat_file, 'w') as f:
        json.dump(data, f)

@app.route('/api/chats', methods=['POST'])
def create_chat():
    chat_id = str(uuid.uuid4())
    chat_data = {
        'messages': [],
        'pdf_text': '',
        'uploaded_pdfs': [],
        'name': f'Chat {chat_id[:4]}'  # Default name using first 4 chars of UUID
    }
    save_chat_data(chat_id, chat_data)
    return jsonify({"id": chat_id}), 201

@app.route('/api/chats', methods=['GET'])
def get_chats():
    chat_ids = [f.stem for f in CHATS_DIR.glob('*.json')]
    return jsonify([{"id": chat_id} for chat_id in chat_ids])

@app.route('/api/chats/<chat_id>', methods=['GET', 'PUT', 'DELETE'])
def manage_chat(chat_id):
    if request.method == 'GET':
        chat_data = get_chat_data(chat_id)
        if not chat_data:
            return jsonify({"error": "Chat not found"}), 404
        return jsonify(chat_data)
    elif request.method == 'PUT':
        chat_data = get_chat_data(chat_id)
        if not chat_data:
            return jsonify({"error": "Chat not found"}), 404
        data = request.get_json()
        new_name = data.get('name')
        if not new_name:
            return jsonify({"error": "Name is required"}), 400
        chat_data['name'] = new_name
        save_chat_data(chat_id, chat_data)
        return jsonify({"success": True})
    elif request.method == 'DELETE':
        chat_file = CHATS_DIR / f'{chat_id}.json'
        if not chat_file.exists():
            return jsonify({"error": "Chat not found"}), 404
        chat_file.unlink()
        return jsonify({"success": True})

@app.route('/api/chats/<chat_id>/upload-pdfs', methods=['POST'])
def upload_pdfs(chat_id):
    chat_data = get_chat_data(chat_id)
    if not chat_data:
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
            return jsonify({"error": f"Error reading PDF {pdf_file.filename}: {str(e)}"}), 500
    
    chat_data['pdf_text'] = pdf_text
    chat_data['uploaded_pdfs'] = uploaded_pdfs
    save_chat_data(chat_id, chat_data)
    return jsonify({"uploaded_pdfs": uploaded_pdfs})

@app.route('/api/chats/<chat_id>/get-pdfs', methods=['GET'])
def get_pdfs(chat_id):
    chat_data = get_chat_data(chat_id)
    if not chat_data:
        return jsonify({"error": "Chat not found"}), 404
    return jsonify({"pdf_text": chat_data.get('pdf_text', '')})

@app.route('/api/chats/<chat_id>/remove-pdf', methods=['POST'])
def remove_pdf(chat_id):
    chat_data = get_chat_data(chat_id)
    if not chat_data:
        return jsonify({"error": "Chat not found"}), 404
    
    data = request.get_json()
    pdf_name = data.get('pdf_name')
    if not pdf_name:
        return jsonify({"error": "PDF name is required"}), 400
    
    if pdf_name not in chat_data['uploaded_pdfs']:
        return jsonify({"error": "PDF not found in chat"}), 404
    
    chat_data['uploaded_pdfs'].remove(pdf_name)
    # Update pdf_text by re-extracting from remaining PDFs (simplified here)
    # In a real scenario, you'd need to store PDFs or re-upload to update text accurately
    # For simplicity, we'll just clear pdf_text if no PDFs remain, or keep it (less accurate)
    if not chat_data['uploaded_pdfs']:
        chat_data['pdf_text'] = ''
    save_chat_data(chat_id, chat_data)
    return jsonify({"success": True})

@app.route('/api/chats/<chat_id>/messages', methods=['POST'])
def send_message(chat_id):
    chat_data = get_chat_data(chat_id)
    if not chat_data:
        return jsonify({"error": "Chat not found"}), 404
    
    message = request.form.get("message")
    if not message:
        return jsonify({"error": "Message is required"}), 400
    
    pdf_text = request.form.get("pdf_text", "")
    
    openai_messages = []
    if pdf_text:
        openai_messages.append({"role": "system", "content": f"You have access to the following documents: {pdf_text}"})
    openai_messages.extend(chat_data['messages'])
    openai_messages.append({"role": "user", "content": message})
    
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=openai_messages,
            max_tokens=4096
        )
        ai_response = response.choices[0].message.content
        chat_data['messages'].append({"role": "user", "content": message})
        chat_data['messages'].append({"role": "assistant", "content": ai_response})
        # Clear PDFs after sending message
        chat_data['uploaded_pdfs'] = []
        chat_data['pdf_text'] = ''
        save_chat_data(chat_id, chat_data)
        return jsonify({"response": ai_response})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    if not os.getenv("OPENAI_API_KEY"):
        print("Error: OPENAI_API_KEY environment variable is not set.")
        exit(1)
    port = int(os.getenv("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
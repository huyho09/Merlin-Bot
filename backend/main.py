import os
import uuid
import json
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import io
from openai import OpenAI
from dotenv import load_dotenv
from PyPDF2 import PdfReader

load_dotenv()

app = Flask(__name__)

# Define allowed origins
def get_allowed_origins():
    return ['http://[::]:8000', 'http://localhost:8000']

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'theChosenOne')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024

CORS(app)
# Apply CORS with dynamic origins
#CORS(app, supports_credentials=True, origins=get_allowed_origins())

db = SQLAlchemy(app)
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(150), nullable=False)
    token = db.Column(db.String(36), unique=True, nullable=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Chat(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    messages = db.Column(db.Text, default='[]')
    pdf_text = db.Column(db.Text, default='')
    uploaded_pdfs = db.Column(db.Text, default='[]')

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({"error": "Token is missing"}), 401
        user = User.query.filter_by(token=token).first()
        if not user:
            return jsonify({"error": "Invalid token"}), 401
        request.user = user
        return f(*args, **kwargs)
    return decorated

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    user = User.query.filter_by(username=username).first()
    if user and user.check_password(password):
        token = str(uuid.uuid4())
        user.token = token
        db.session.commit()
        return jsonify({"message": "Login successful", "token": token}), 200
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/logout', methods=['POST'])
@token_required
def logout():
    user = request.user
    user.token = None
    db.session.commit()
    return jsonify({"message": "Logout successful"}), 200

@app.route('/api/check-login', methods=['GET'])
def check_login():
    token = request.headers.get('Authorization')
    if token and User.query.filter_by(token=token).first():
        return jsonify({"logged_in": True}), 200
    return jsonify({"logged_in": False}), 401

@app.route('/api/chats', methods=['POST'])
@token_required
def create_chat():
    chat_id = str(uuid.uuid4())
    chat = Chat(
        id=chat_id,
        user_id=request.user.id,
        name=f'Chat {chat_id[:4]}',
        messages=json.dumps([]),
        pdf_text='',
        uploaded_pdfs=json.dumps([])
    )
    db.session.add(chat)
    db.session.commit()
    return jsonify({"id": chat_id}), 201

@app.route('/api/chats', methods=['GET'])
@token_required
def get_chats():
    chats = Chat.query.filter_by(user_id=request.user.id).all()
    return jsonify([{"id": chat.id, "name": chat.name} for chat in chats])

@app.route('/api/chats/<chat_id>', methods=['GET', 'PUT', 'DELETE'])
@token_required
def manage_chat(chat_id):
    chat = Chat.query.filter_by(id=chat_id, user_id=request.user.id).first()
    if not chat:
        return jsonify({"error": "Chat not found"}), 404
    
    if request.method == 'GET':
        return jsonify({
            "id": chat.id,
            "name": chat.name,
            "messages": json.loads(chat.messages),
            "pdf_text": chat.pdf_text,
            "uploaded_pdfs": json.loads(chat.uploaded_pdfs)
        })
    elif request.method == 'PUT':
        data = request.get_json()
        new_name = data.get('name')
        if not new_name:
            return jsonify({"error": "Name is required"}), 400
        chat.name = new_name
        db.session.commit()
        return jsonify({"success": True})
    elif request.method == 'DELETE':
        db.session.delete(chat)
        db.session.commit()
        return jsonify({"success": True})

@app.route('/api/chats/<chat_id>/upload-pdfs', methods=['POST'])
@token_required
def upload_pdfs(chat_id):
    chat = Chat.query.filter_by(id=chat_id, user_id=request.user.id).first()
    if not chat:
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
    
    chat.pdf_text = pdf_text
    chat.uploaded_pdfs = json.dumps(uploaded_pdfs)
    db.session.commit()
    return jsonify({"uploaded_pdfs": uploaded_pdfs})

@app.route('/api/chats/<chat_id>/get-pdfs', methods=['GET'])
@token_required
def get_pdfs(chat_id):
    chat = Chat.query.filter_by(id=chat_id, user_id=request.user.id).first()
    if not chat:
        return jsonify({"error": "Chat not found"}), 404
    return jsonify({"pdf_text": chat.pdf_text})

@app.route('/api/chats/<chat_id>/remove-pdf', methods=['POST'])
@token_required
def remove_pdf(chat_id):
    chat = Chat.query.filter_by(id=chat_id, user_id=request.user.id).first()
    if not chat:
        return jsonify({"error": "Chat not found"}), 404
    
    data = request.get_json()
    pdf_name = data.get('pdf_name')
    if not pdf_name:
        return jsonify({"error": "PDF name is required"}), 400
    
    uploaded_pdfs = json.loads(chat.uploaded_pdfs)
    if pdf_name not in uploaded_pdfs:
        return jsonify({"error": "PDF not found in chat"}), 404
    
    uploaded_pdfs.remove(pdf_name)
    chat.uploaded_pdfs = json.dumps(uploaded_pdfs)
    if not uploaded_pdfs:
        chat.pdf_text = ''
    db.session.commit()
    return jsonify({"success": True})

@app.route('/api/chats/<chat_id>/messages', methods=['POST'])
@token_required
def send_message(chat_id):
    chat = Chat.query.filter_by(id=chat_id, user_id=request.user.id).first()
    if not chat:
        return jsonify({"error": "Chat not found"}), 404

    message = request.form.get("message")
    if not message:
        return jsonify({"error": "Message is required"}), 400

    pdf_text = request.form.get("pdf_text", "")
    messages = json.loads(chat.messages)

    # New system message
    base_system_message = "You are a helpful assistant who provides detailed and comprehensive responses to users' questions. Always aim to give thorough explanations and additional information where relevant."
    if pdf_text:
        system_message = f"{base_system_message}\n\nYou have access to the following documents:\n{pdf_text}"
    else:
        system_message = base_system_message

    openai_messages = [{"role": "system", "content": system_message}]
    openai_messages.extend(messages)
    openai_messages.append({"role": "user", "content": message})

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=openai_messages,
            max_tokens=4096
        )
        ai_response = response.choices[0].message.content
        messages.append({"role": "user", "content": message})
        messages.append({"role": "assistant", "content": ai_response})
        chat.messages = json.dumps(messages)
        # Do not clear pdf_text and uploaded_pdfs
        db.session.commit()
        return jsonify({"response": ai_response})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def init_db():
    with app.app_context():
        db.create_all()
        if not User.query.filter_by(username='admin').first():
            admin = User(username='admin')
            admin.set_password('Password@123')
            db.session.add(admin)
            db.session.commit()

if __name__ == '__main__':
    if not os.getenv("OPENAI_API_KEY"):
        print("Error: OPENAI_API_KEY environment variable is not set.")
        exit(1)
    init_db()
    port = int(os.getenv("PORT", 5001))
    app.run(host='0.0.0.0', port=port, debug=True)
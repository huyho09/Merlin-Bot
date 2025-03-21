from flask import Flask, jsonify, request
from flask_cors import CORS
import uuid
import os
from openai import OpenAI
from dotenv import load_dotenv


load_dotenv()

app = Flask(__name__)
CORS(app)  # Allow all origins

# In-memory storage for chats
chats = {}

# Initialize OpenAI client
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@app.route('/api/chats', methods=['GET'])
def get_chats():
    return jsonify([{"id": chat_id} for chat_id in chats.keys()]), 200

@app.route('/api/chats', methods=['POST'])
def create_chat():
    chat_id = str(uuid.uuid4())
    chats[chat_id] = []
    return jsonify({"id": chat_id}), 201

@app.route('/api/chats/<chat_id>', methods=['GET'])
def get_chat(chat_id):
    if chat_id not in chats:
        return jsonify({"error": "Chat not found"}), 404
    return jsonify(chats[chat_id]), 200

@app.route('/api/chats/<chat_id>/messages', methods=['POST'])
def send_message(chat_id):
    if chat_id not in chats:
        return jsonify({"error": "Chat not found"}), 404
    data = request.get_json()
    if not data or "message" not in data:
        return jsonify({"error": "Message is required"}), 400
    user_message = data["message"]
    chats[chat_id].append({"role": "user", "content": user_message})
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=chats[chat_id]
        )
        ai_response = response.choices[0].message.content
        chats[chat_id].append({"role": "assistant", "content": ai_response})
        return jsonify({"response": ai_response}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to get AI response: {str(e)}"}), 500

if __name__ == '__main__':
    if not os.getenv("OPENAI_API_KEY"):
        print("Error: OPENAI_API_KEY environment variable is not set.")
        exit(1)
    app.run(host='0.0.0.0', port=5001, debug=True)
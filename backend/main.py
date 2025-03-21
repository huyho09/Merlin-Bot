from flask import Flask, jsonify, request
from flask_cors import CORS
import uuid
import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
# Enable CORS for all origins to prevent 403 errors during development
CORS(app)

# In-memory storage for chats (chat_id: list of messages)
chats = {}

# Initialize OpenAI client with API key from environment variable
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Endpoint to list all chat IDs
@app.route('/api/chats', methods=['GET'])
def get_chats():
    return jsonify([{"id": chat_id} for chat_id in chats.keys()]), 200

# Endpoint to create a new chat
@app.route('/api/chats', methods=['POST'])
def create_chat():
    chat_id = str(uuid.uuid4())  # Generate a unique chat ID
    chats[chat_id] = []  # Initialize empty message list for the new chat
    return jsonify({"id": chat_id}), 201

# Endpoint to retrieve messages for a specific chat
@app.route('/api/chats/<chat_id>', methods=['GET'])
def get_chat(chat_id):
    if chat_id not in chats:
        return jsonify({"error": "Chat not found"}), 404
    return jsonify(chats[chat_id]), 200

# Endpoint to send a message and get an AI response
@app.route('/api/chats/<chat_id>/messages', methods=['POST'])
def send_message(chat_id):
    if chat_id not in chats:
        return jsonify({"error": "Chat not found"}), 404

    data = request.get_json()
    if not data or "message" not in data:
        return jsonify({"error": "Message is required"}), 400

    user_message = data["message"]
    # Append user message to the chat history
    chats[chat_id].append({"role": "user", "content": user_message})

    try:
        # Call OpenAI API with the full chat history for context
        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",  # You can change to "gpt-4" if available
            messages=chats[chat_id]
        )
        ai_response = response.choices[0].message.content
        # Append AI response to the chat history
        chats[chat_id].append({"role": "assistant", "content": ai_response})
        return jsonify({"response": ai_response}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to get AI response: {str(e)}"}), 500

if __name__ == '__main__':
    # Check if OpenAI API key is set
    if not os.getenv("OPENAI_API_KEY"):
        print("Error: OPENAI_API_KEY environment variable is not set.")
        exit(1)
    # Run Flask app on localhost:5000
    app.run(host='127.0.0.1', port=5000, debug=True)
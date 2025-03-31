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
import googlemaps  # Add this import for Google Maps Places API
import urllib.parse  # For URL encoding

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

db = SQLAlchemy(app)
migrate = Migrate(app, db)
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
gmaps = googlemaps.Client(key=os.getenv("GOOGLE_API_KEY"))  # Replace with your Google Maps API key
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_API_KEY")  # Use the same key for Embed API

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(150), nullable=False)
    token = db.Column(db.String(36), unique=True, nullable=True)
    latitude = db.Column(db.Float, nullable=True)  # Added for location
    longitude = db.Column(db.Float, nullable=True)  # Added for location

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
        # Check if token starts with "Bearer " and remove it
        if token and token.startswith("Bearer "):
            token = token[7:]
        if not token:
            return jsonify({"error": "Token is missing"}), 401
        user = User.query.filter_by(token=token).first()
        if not user:
            return jsonify({"error": "Invalid token"}), 401
        request.user = user
        return f(*args, **kwargs)
    return decorated

# New endpoint to update user location
@app.route('/api/users/location', methods=['PUT'])
@token_required
def update_user_location():
    data = request.get_json()
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    if latitude is None or longitude is None:
        return jsonify({"error": "Latitude and longitude are required"}), 400
    user = request.user
    user.latitude = latitude
    user.longitude = longitude
    db.session.commit()
    return jsonify({"message": "Location updated successfully"}), 200

# Helper function to fetch restaurants
def get_restaurants(latitude, longitude, keywords=None, radius=3000):
    params = {
        'location': (latitude, longitude),
        'radius': radius,  # Default 1 km radius
        'type': 'restaurant'
    }
    if keywords:
        params['keyword'] = ' '.join(keywords)
    try:
        results = gmaps.places_nearby(**params)
        return results.get('results', [])
    except Exception as e:
        print(f"Error fetching restaurants: {e}")
        return []

# Helper function to extract food keywords
def extract_food_keywords(message):
    food_types = [
        'Italian', 'Chinese', 'Japanese', 'Mexican', 'Indian', 'American', 'French', 
        'Mediterranean', 'Middle Eastern', 'Vietnamese', 'Thai', 'Greek', 'Spanish', 
        'German', 'Russian', 'African', 'Caribbean', 'South American', 'Pizza', 
        'Burger', 'Sandwich', 'Sushi', 'Tapas', 'Steak', 'Seafood', 'Vegetarian', 
        'Vegan', 'Gluten-free'
    ]
    lower_message = message.lower()
    return [food for food in food_types if food.lower() in lower_message]

# Helper function to format restaurant data with iframe
def format_restaurants(restaurants):
    if not restaurants:
        return "No restaurants found nearby.\n"
    formatted = "Nearby restaurants:\n"
    for r in restaurants[:3]:  # Limit to top 3 for brevity
        name = r.get('name', 'Unknown')
        rating = r.get('rating', 'N/A')
        vicinity = r.get('vicinity', 'Unknown location')
        lat = r['geometry']['location']['lat']
        lng = r['geometry']['location']['lng']
        # Generate Google Maps Embed iframe URL
        query = urllib.parse.quote(f"{name}, {vicinity}")
        iframe_url = f"https://www.google.com/maps/embed/v1/place?key={GOOGLE_MAPS_API_KEY}&q={query}&center={lat},{lng}&zoom=15"
        formatted += (
            f"- **{name}** (Rating: {rating}, Location: {vicinity})\n"
            f"  Here's a map:\n"
            f"  <iframe width='100%' height='300' frameborder='0' style='border:0' src='{iframe_url}' allowfullscreen></iframe>\n"
        )
    return formatted

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

    # System message setup
    base_system_message = (
        "You are a helpful assistant. Provide detailed and comprehensive responses to the user's most recent question. "
        "Do not include information from previous topics or unrelated suggestions unless the current question explicitly refers to them. "
        "When providing any code snippet, regardless of the language, if it is HTML code snippet (or ```html), wrap it in a <pre> and <code class='language-markup'> block" 
        "For example: <pre><code class='language-markup'><!-- HTML code here -->&lt;div class='example'&gt;Hello World&lt;/div&gt;</code></pre>"
    )
    if pdf_text:
        system_message = f"{base_system_message}\n\nYou have access to the following documents:\n{pdf_text}"
    else:
        system_message = base_system_message

    openai_messages = [{"role": "system", "content": system_message}]
    openai_messages.extend(messages)
    openai_messages.append({"role": "user", "content": message})

    # Restaurant suggestion logic
    restaurant_keywords = ['restaurant', 'eat', 'food', 'dinner', 'lunch', 'meal']
    intent_keywords = ['near me', 'find', 'where', 'suggest', 'recommend', 'looking for', 'want to eat']
    lower_message = message.lower()
    
    # Strict condition: both a restaurant keyword and an intent keyword must be present
    is_restaurant_query = any(keyword in lower_message for keyword in restaurant_keywords) and \
                         any(intent in lower_message for intent in intent_keywords)
    print(f'Is Restaurant query: {is_restaurant_query}')
    if is_restaurant_query:
        user = request.user
        if user.latitude is None or user.longitude is None:
            response = "Please share your location first by clicking the 'Share Location' button."
            messages.append({"role": "user", "content": message})
            messages.append({"role": "assistant", "content": response})
            chat.messages = json.dumps(messages)
            db.session.commit()
            return jsonify({"response": response})
        else:
            print(f'Weird Flow: {is_restaurant_query}')
            print("Error")
            keywords = extract_food_keywords(message)
            restaurants = get_restaurants(user.latitude, user.longitude, keywords)
            formatted_restaurants = format_restaurants(restaurants)
            prompt = (
                f"User's location: ({user.latitude}, {user.longitude})\n"
                f"User's message: {message}\n"
                f"{formatted_restaurants}\n"
                "Task: Suggest one or more restaurants based on the user's preferences (or lack thereof). "
                "For each restaurant, provide the following details:\n"
                "1. Name of the restaurant\n"
                "2. Notable reason(s) to recommend it\n"
                "3. Address\n"
                "4. Google Maps Link: Use this format: put the name of the restaurant as a link: https://www.google.com/maps/search/?api=1&query=<LAT>,<LNG>\n"
                "5. Google Maps: display an iframe of google map"
                "If preferences are unclear, suggest a variety of options and explain why each is a good choice. "
                "Ask follow-up questions if needed to clarify their food interests."
                )
            try:
                response = openai_client.chat.completions.create(
                    model="gpt-4o",
                    messages=[{"role": "system", "content": system_message}, {"role": "user", "content": prompt}],
                    max_tokens=4096
                )
                ai_response = response.choices[0].message.content
                messages.append({"role": "user", "content": message})
                messages.append({"role": "assistant", "content": ai_response})
                chat.messages = json.dumps(messages)
                db.session.commit()
                return jsonify({"response": ai_response})
            except Exception as e:
                return jsonify({"error": str(e)}), 500

    # Default OpenAI response for all other queries
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

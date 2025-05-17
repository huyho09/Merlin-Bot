from flask import request,jsonify,Blueprint
import uuid
from models import User
from middleware import *
from db import db

auth_bp = Blueprint('auth',__name__)

"""explain: Authenticates a user based on username and password, returning a token on success."""
@auth_bp.route('/api/login', methods=['POST'])
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

"""explain: Invalidates the user's current authentication token."""
@auth_bp.route('/api/logout', methods=['POST'])
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

"""explain: Checks if the provided token in the Authorization header is valid."""
@auth_bp.route('/api/check-login', methods=['GET'])
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
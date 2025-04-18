from models import User

"""explain: Decorator function to require a valid authentication token in the request header."""
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
from main import app
from auth.routes import auth_bp

app.register_blueprint(auth_bp)
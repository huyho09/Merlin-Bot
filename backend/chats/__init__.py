from main import app
from chats.routes import chats_bp

app.register_blueprint(chats_bp)
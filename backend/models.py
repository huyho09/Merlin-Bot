import uuid
from werkzeug.security import generate_password_hash, check_password_hash
from db import db


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(150), nullable=False)
    token = db.Column(db.String(36), unique=True, nullable=True, index=True)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)

    """explain: Sets the user's password by hashing it."""
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    """explain: Checks if the provided password matches the stored hash."""
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    

class Chat(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=True)
    messages = db.Column(db.Text, default='[]')
    pdf_text = db.Column(db.Text, default='')
    uploaded_pdfs = db.Column(db.Text, default='[]')

    user = db.relationship('User', backref=db.backref('chats', lazy=True))


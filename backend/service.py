from config import AppConfig
import googlemaps # Add this import for Google Maps Places API
from openai import OpenAI
from models import User,Chat
import os
"""
    Used for : 
        _Service Init with GGMap and OpenAI
"""
class GoogleMapService: 
    def __init__(self):
        if not AppConfig.gmaps_api_key: 
            print("Warning: GOOGLE_API_KEY not found in environment variables. Location features will be limited.")
            self.gmaps = None
        else: 
            self.gmaps = googlemaps.Client(key = AppConfig.gmaps_api_key)
            self.GOOGLE_MAPS_API_KEY = self.gmaps
    def getGmaps(self):
        return self.gmaps, self.GOOGLE_MAPS_API_KEY
    
class OpenAiService: 
    def __init__(self):
        self.openai_client = OpenAI(api_key=AppConfig.open_ai_key)
    def getOpenAiClient(self): 
        return self.openai_client



class initDB: 
    def __init__(self,db,app):
        self.db = db
        self.app = app
    """explain: Initializes the database schema and creates a default admin user if one doesn't exist."""
    def init_db(self):
        with self.app.app_context():
            print("Initializing database...")
            try:
                self.db.create_all()
                if not User.query.filter_by(username='admin').first():
                    print("Creating default admin user...")
                    admin_password = os.getenv('ADMIN_PASSWORD', 'Password@123')
                    admin = User(username='admin')
                    admin.set_password(admin_password)
                    self.db.session.add(admin)
                    self.db.session.commit()
                    print("Default admin user created.")
                else:
                    print("Admin user already exists.")
                print("Database initialized successfully.")
            except Exception as e:
                print(f"Error during database initialization: {e}")

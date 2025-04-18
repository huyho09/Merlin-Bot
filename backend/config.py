import os 
from dotenv import load_dotenv
load_dotenv()
class AppConfig: 
    """
    Used for: 
        _ Get config information for app : 
            + SECRET KEY 
            + SQLALCHEMY_DATABASE_URI
            + SQLALCHEMY_TRACK_MODIFICATIONS
            + MAX_CONTENT_LENGTH (Limit uploads to 100MB total)
        _ Google Map API Key
    """
    SECRET_KEY = os.getenv('SECRET_KEY', 'theChosenOne')
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///site.db') 
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024


    open_ai_key=os.getenv("OPENAI_API_KEY")
    gmaps_api_key = os.getenv("GOOGLE_API_KEY") 
    port = int(os.getenv("PORT", 5001))
    debug_mode = os.getenv("FLASK_DEBUG", "False").lower() == "true"



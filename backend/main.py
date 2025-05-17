import os
from config import AppConfig
from service import GoogleMapService, OpenAiService
from service import initDB
from flask import Flask
from flask_migrate import Migrate
from flask_cors import CORS
from config import AppConfig
from auth.routes import auth_bp
from chats.routes import chats_bp
from location.routes import location_bp
from flask_migrate import Migrate
from db import db

def create_app():
 
    app = Flask(__name__)
    print("CORS config for app init")
    CORS(app)
    app.config.from_object(AppConfig) 
    db.init_app(app)

    app.register_blueprint(chats_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(location_bp)

    print("Registered Routes:")
    print("Endpoint        Methods        Rule")
    print("-" * 50)
    for rule in app.url_map.iter_rules():
         methods = ','.join(sorted(rule.methods))
         print(f"{rule.endpoint:16s} {methods:14s} {rule.rule}")
    print("-" * 50)
    

    return app

if __name__ == '__main__':
    app = create_app()
    migrate = Migrate(app,db)       


    db_handle = initDB(db, app)
    db_handle.init_db()

    ggmap_handle = GoogleMapService()
    gmaps, GOOGLE_MAPS_API_KEY = ggmap_handle.getGmaps()

    openai_handle = OpenAiService()
    openai_client = openai_handle.getOpenAiClient()

    # Run server
    print(f"Starting Flask server on port {AppConfig.port} with debug mode: {AppConfig.debug_mode}")
    host = os.getenv("FLASK_HOST", "0.0.0.0")
    app.run(host=host, port=AppConfig.port, debug=AppConfig.debug_mode)
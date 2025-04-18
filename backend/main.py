import os
from app import create_app, db
from config import AppConfig
from service import GoogleMapService, OpenAiService
from service import initDB

if __name__ == '__main__':
    app = create_app()

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

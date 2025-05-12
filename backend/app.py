from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_migrate import Migrate
from flask_cors import CORS
from config import AppConfig



db = SQLAlchemy()  
migrate = Migrate()  

def create_app():
    app = Flask(__name__)
    app.config.from_object(AppConfig) 
    CORS(app)

    
    db.init_app(app)
    migrate.init_app(app, db)


    return app

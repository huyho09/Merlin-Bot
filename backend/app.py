from flask import Flask
from flask_migrate import Migrate
from flask_cors import CORS
from config import AppConfig


def create_app():
 
    app = Flask(__name__)
    print("CORS config for app init")
    CORS(app)

     # --- Place print here, after all registrations ---
    print("Registered Routes:")
    print("Endpoint        Methods        Rule")
    print("-" * 50)
    for rule in app.url_map.iter_rules():
         methods = ','.join(sorted(rule.methods))
         print(f"{rule.endpoint:16s} {methods:14s} {rule.rule}")
    print("-" * 50)
    # -------------------------------------------------
    app.config.from_object(AppConfig) 
    

    return app

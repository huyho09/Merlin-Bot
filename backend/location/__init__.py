from main import app
from location.routes import location_bp


app.register_blueprint(location_bp)
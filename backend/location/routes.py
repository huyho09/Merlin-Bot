from flask import request,jsonify,Blueprint
from middleware import *
from utils import LocationHandle

location_bp = Blueprint('location',__name__)

"""explain: Updates the latitude and longitude for the authenticated user."""
@location_bp.route('/api/users/location', methods=['PUT'])
@token_required
def update_user_location():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request must be JSON"}), 400
    user = request.user
    location_handle = LocationHandle(data,user)
    latitude,longitude = location_handle.getLocation()

    # Set to None if null was explicitly passed, otherwise keep the value
    user.latitude = latitude if latitude is not None else None
    user.longitude = longitude if longitude is not None else None

    return location_handle.saveToDB(latitude,longitude)
    
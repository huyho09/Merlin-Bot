from flask import jsonify, request
from functools import wraps
import urllib.parse # For URL encoding
import re
from service import GoogleMapService

class LocationHandle(): 
    def __init__(self,data,user,db):
        self.db = db
        self.data = data
        self.user = user
    def getLocation(self): 
        latitude = self.data.get('latitude')
        longitude = self.data.get('longitude')
        return latitude,longitude
    def validateLatLng(self,latitude,longitude): 
        # Allow null values to clear location
        if latitude is not None and longitude is None:
            return jsonify({"error": "Longitude must be provided if latitude is provided"}), 400
        if longitude is not None and latitude is None:
            return jsonify({"error": "Latitude must be provided if longitude is provided"}), 400
        # Validate coordinate types if not None
        if latitude is not None and not isinstance(latitude, (int, float)):
            return jsonify({"error": "Invalid latitude format"}), 400
        if longitude is not None and not isinstance(longitude, (int, float)):
            return jsonify({"error": "Invalid longitude format"}), 400
        return None,None            
    def saveToDB(self,latitude,longitude): 
        try:
            self.db.session.commit()
            if latitude is not None and longitude is not None:
                message = "Location updated successfully"
            else:
                message = "Location removed successfully"
            return jsonify({"message": message}), 200
        except Exception as e:
            self.db.session.rollback()
            print(f"Error updating location in DB: {e}")
            return jsonify({"error": "Database error updating location"}), 500



class RestaurantHandle(): 
    """explain: Fetches nearby restaurants using the Google Maps Places API based on latitude, longitude, optional keywords, and radius."""
    def get_restaurants(latitude, longitude, keywords=None, radius=1000):
        ggmap_handle = GoogleMapService
        gmaps = ggmap_handle.getGmaps()
        if not gmaps: # Check if googlemaps client is initialized
            print("Google Maps client not available. Cannot fetch restaurants.")
            return []
        params = {
            'location': (latitude, longitude),
            'radius': radius,
            'type': 'restaurant'
        }
        if keywords:
            # Join keywords for the Places API query
            params['keyword'] = ' '.join(keywords)
        try:
            print(f"Querying Google Places API with params: {params}") # Debug log
            results = gmaps.places_nearby(**params)
            # print(f"Places API response: {results}") # Debug log (can be verbose)
            return results.get('results', [])
        except Exception as e:
            print(f"Error fetching restaurants from Google Maps API: {e}")
            return []
    def extract_food_keywords(message):
    # Expanded list of common food types and cuisines
        food_types = [
            'italian', 'chinese', 'japanese', 'mexican', 'indian', 'american', 'french',
            'mediterranean', 'middle eastern', 'vietnamese', 'pho', 'thai', 'greek', 'spanish',
            'german', 'russian', 'african', 'caribbean', 'south american', 'korean', 'bbq',
            'pizza', 'burger', 'sandwiches', 'sushi', 'ramen', 'tapas', 'steak', 'seafood',
            'vegetarian', 'vegan', 'gluten-free', 'bakery', 'cafe', 'coffee', 'dessert', 'brunch'
        ]
        lower_message = message.lower()
        # Return keywords found in the message
        return [food for food in food_types if food in lower_message]

    """explain: Formats a list of restaurant data into a string suitable for providing context to the LLM."""
    def format_restaurants(restaurants):
        ggmap_handle = GoogleMapService
        gmaps,GOOGLE_MAPS_API_KEY = ggmap_handle.getGmaps()
        if not restaurants:
            return "Context: No relevant restaurants found in the immediate vicinity based on the query.\n"
        # Limit context size to avoid overly long prompts
        context_limit = 3
        formatted = f"Context: Nearby Restaurants Found (Top {min(len(restaurants), context_limit)} relevant results):\n"
        for r in restaurants[:context_limit]:
            name = r.get('name', 'Unknown Name')
            rating = r.get('rating', 'N/A')
            vicinity = r.get('vicinity', 'Unknown location')
            lat = r.get('geometry', {}).get('location', {}).get('lat')
            lng = r.get('geometry', {}).get('location', {}).get('lng')
            place_id = r.get('place_id', None) # Get place_id if available

            formatted += f"- Name: {name}, Rating: {rating}, Address: {vicinity}"
            if lat and lng and GOOGLE_MAPS_API_KEY:
                if place_id:
                    embed_query = f"place_id:{place_id}"
                elif lat and lng:
                    embed_query = f"{lat},{lng}"
                else:
                    embed_query = urllib.parse.quote(f'{name}, {vicinity}')

                iframe_url = f"https://www.google.com/maps/embed/v1/place?key={GOOGLE_MAPS_API_KEY}&q={embed_query}"

                # Include iframe tag in the context provided to the LLM
                formatted += f"\n  MapEmbed: <iframe width='100%' height='300' frameborder='0' style='border:0' src='{iframe_url}' allowfullscreen></iframe>\n"
            else:
                formatted += "\n  (Map data incomplete or API key missing)\n"
            formatted += "\n" # Newline for separation

        return formatted




"""explain: Parses the AI's response to extract reasoning and the final answer based on markers."""
def parse_reasoning_response(response_text):
    reasoning = None
    answer = response_text # Default to the full text if parsing fails

    # Try to extract reasoning using regex (flexible with whitespace)
    reasoning_match = re.search(r"<reasoning>(.*?)</reasoning>", response_text, re.DOTALL | re.IGNORECASE)
    if reasoning_match:
        reasoning = reasoning_match.group(1).strip()

    # Try to extract the answer
    answer_match = re.search(r"<answer>(.*?)</answer>", response_text, re.DOTALL | re.IGNORECASE)
    if answer_match:
        answer = answer_match.group(1).strip()
    elif reasoning is not None:
        # If reasoning was found but answer wasn't, assume answer is the rest of the text
        # This attempts to remove the reasoning part from the original text
        answer = re.sub(r"<reasoning>.*?</reasoning>", "", response_text, flags=re.DOTALL | re.IGNORECASE).strip()
        # Additional cleanup in case only reasoning was returned (unlikely but possible)
        if not answer and reasoning:
             answer = "..." # Placeholder if only reasoning was somehow returned

    return reasoning, answer

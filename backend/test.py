load_dotenv()

app = Flask(__name__)
# Enable CORS for all origins to prevent 403 errors during development
#CORS(app)
CORS(app, resources={r"/*": {"origins": "http://localhost:8000"}})  # Allow only the frontend origin

# In-memory storage for chats (chat_id: list of messages)
chats = {}

# Initialize OpenAI client with API key from environment variable
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Chat Application

## Project Description
This is a web-based chat application inspired by ChatGPT and Grok, featuring a user-friendly interface for starting new chats, viewing chat history, and interacting with an AI-powered backend. The front end is built with HTML, CSS, and JavaScript, while the backend uses Flask and integrates with the OpenAI API to provide intelligent responses.

## Project Structure
- **Front End:**
  - `index.html`: The main HTML file defining the chat interface structure.
  - `styles.css`: Custom CSS for styling the chat UI, including sidebar and message layouts.
  - `script.js`: JavaScript code managing chat functionality (new chats, history, messaging) and API interactions.
- **Back End:**
  - `main.py`: Flask application providing API endpoints for chat management and AI responses via OpenAI.
- **README.md**: This file, containing project details and instructions.

## How to Run the Project

### Prerequisites
- **Python 3.x**: Required for the backend.
- **pip**: Python package manager for installing dependencies.
- **An OpenAI API Key**: Obtainable from [OpenAI API Keys](https://platform.openai.com/api-keys).
- **A Web Browser**: For accessing the front end.

### Backend Setup
1. **Navigate to the Backend Directory**:
   ```bash
   cd /path/to/your/project/backend
   ```
   Replace `/path/to/your/project/backend` with the actual path (e.g., `/Users/huyho/Documents/Documents-HuyMacBookPro/Projects/chatbot-clone/backend/`).

2. **Create virtual environment**:
   ```bash
   cd /path/to/your/project/backend
   python -m venv .venv
   source .venv/bin/activate // MacOS/Linux activate virtual env
   .venv\Script\activate     // Windows
   ```

3. **Install Dependencies**:
   ```bash
   python -m pip install -r requirements.txt
   ```

4. **Set the OpenAI API Key**:
   - On macOS/Linux:
     ```bash
     export OPENAI_API_KEY='your-api-key-here'
     ```
   - On Windows:
     ```cmd
     set OPENAI_API_KEY=your-api-key-here
     ```
   Replace `'your-api-key-here'` with your actual OpenAI API key.

4. **Run the Flask Server**:
   ```bash
   python main.py
   ```
   The backend will start on `http://localhost:5001`. If port 5000 is in use, see the troubleshooting section below.

### Front End Setup
1. **Navigate to the Front End Directory**:
   ```bash
   cd /path/to/your/project
   ```
   Ensure `index.html`, `styles.css`, and `script.js` are in this directory.

2. **Serve the Front End**:
   Use Python’s built-in HTTP server:
   ```bash
   python -m http.server 8000
   ```

3. **Access the Application**:
   Open your browser and go to `http://localhost:8000/index.html`.

### Usage
- **Start a New Chat**: Click "New Chat" in the sidebar to begin a new conversation.
- **Send Messages**: Type in the input box and press "Send" or Enter to interact with the AI.
- **View Chat History**: Click on a chat in the sidebar to switch between conversations.

## Troubleshooting
- **Port 5000 in Use**:
  - Check for processes using port 5000:
    ```bash
    lsof -i :5000
    ```
    Kill the process with `kill -9 <PID>` (replace `<PID>` with the process ID).
  - Alternatively, change the port in `main.py`:
    ```python
    app.run(host='0.0.0.0', port=5000, debug=True)
    ```
    Update `API_BASE` in `script.js` to `http://localhost:5000`.
- **403 Forbidden Error**:
  - Ensure `CORS(app)` is in `main.py` to allow all origins.
  - Verify the backend is running and accessible (`curl -X GET http://localhost:5000/api/chats`).
- **OpenAI API Key Error**:
  - Confirm the key is set (`echo $OPENAI_API_KEY`) before running `main.py`.

## Future Improvements
- [ ] **Persistent Storage**: Replace the in-memory `chats` dictionary with a database (e.g., SQLite or PostgreSQL) to save chat history across restarts.
- [ ] **User Authentication**: Add login functionality to support multiple users with private chat histories.
- [ ] **UI Enhancements**: Implement message editing, deletion, or a loading indicator for AI responses.
- [ ] **Better Error Handling**: Display user-friendly error messages on the front end for network or API issues.
- [ ] **Model Options**: Allow users to select different OpenAI models (e.g., `gpt-4`) or adjust parameters like temperature.
- [ x ] **Rate Limiting**: Add rate limiting on the backend to prevent API abuse.
- [ ] **Token Management**: Handle long conversations by truncating or summarizing older messages to stay within OpenAI’s token limits.

## Notes
- The backend uses `GPT-4o` by default
- For production, restrict CORS origins (e.g., `CORS(app, resources={r"/api/*": {"origins": "http://yourdomain.com"}})`) and deploy with a WSGI server like Gunicorn.

For additional support, refer to:
- [Flask Documentation](https://flask.palletsprojects.com/)
- [OpenAI API Documentation](https://platform.openai.com/docs/)
```

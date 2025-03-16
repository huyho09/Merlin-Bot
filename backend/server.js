const path = require('path');
require('dotenv').config({ path: path.join(__dirname, './.env') });

const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow all CORS
app.use(express.json());

//const apiKey = process.env.OPENAI_API_KEY;
// Initialize OpenAI with API key from environment
console.log('API Key:', process.env.OPENAI_API_KEY);
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, chatHistory } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Prepare messages array including history
        const messages = [
            { role: 'system', content: 'You are a helpful AI assistant similar to Grok.' },
            ...chatHistory,
            { role: 'user', content: message }
        ];

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messages,
            temperature: 0.7,
            max_tokens: 1000
        });

        const aiResponse = response.choices[0].message.content;
        res.json({ response: aiResponse });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
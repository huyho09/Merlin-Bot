require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors()); // Allow all CORS
app.use(bodyParser.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Store chat history in memory
let chatHistory = {};

app.post('/chat', async (req, res) => {
    const { chatId, message } = req.body;
    
    if (!chatId || !message) {
        return res.status(400).json({ error: 'Chat ID and message are required' });
    }

    if (!chatHistory[chatId]) {
        chatHistory[chatId] = [];
    }

    chatHistory[chatId].push({ role: 'user', content: message });

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o',
                messages: chatHistory[chatId],
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const botReply = response.data.choices[0].message.content;
        chatHistory[chatId].push({ role: 'assistant', content: botReply });

        res.json({ reply: botReply });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch response' });
    }
});

// New Chat
app.post('/new-chat', (req, res) => {
    const chatId = `chat_${Date.now()}`;
    chatHistory[chatId] = [];
    res.json({ chatId });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

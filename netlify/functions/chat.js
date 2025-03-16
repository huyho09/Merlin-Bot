const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const serverless = require('serverless-http');
const { Configuration, OpenAIApi } = require('@openai/ai');

const app = express();
app.use(express.json());
app.use(require('cors')());

const configuration = new Configuration({
  apiKey: 'OPENAI_API_KEY',
});
const openai = new OpenAIApi(configuration);

app.post('/', async (req, res) => {
  try {
    const { history } = req.body;
    const messages = history.map((message) => ({
      role: message.sender === 'user' ? 'user' : 'assistant',
      content: message.content,
    }));
    const completion = await openai.createChatCompletion({
      model: 'gpt-4o',
      messages,
    });
    const response = completion.data.choices[0].message.content;
    res.json({ message: response });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = serverless(app);
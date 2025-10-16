import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

if (!process.env.OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY environment variable.');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');

app.use(express.static(publicDir));

app.post('/api/message', async (req, res) => {
  const { message, history = [] } = req.body ?? {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required.' });
  }

  const conversation = [
    ...history.map((item) => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: String(item.content ?? '')
    })),
    { role: 'user', content: message }
  ];

  try {
    const response = await openai.responses.create({
      model: 'gpt-5.0',
      input: conversation.map((entry) => ({
        role: entry.role,
        content: [
          {
            type: 'text',
            text: entry.content
          }
        ]
      }))
    });

    const reply = (response.output_text ?? '').trim();

    if (!reply) {
      return res.status(502).json({ error: 'No response received from model.' });
    }

    res.json({
      reply,
      conversation: [...conversation, { role: 'assistant', content: reply }]
    });
  } catch (error) {
    console.error('Error communicating with OpenAI:', error);
    const message = error?.response?.data?.error?.message || error.message || 'Unknown error';
    res.status(500).json({ error: message });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

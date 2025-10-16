import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn('[warning] OPENAI_API_KEY is not set. Requests to /api/chat will fail until it is configured.');
}

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/chat', async (req, res) => {
  const { message, history = [] } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'A user message is required.' });
  }

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });
  }

  const messages = [
    {
      role: 'system',
      content: 'You are ChatGPT, a helpful assistant. Provide concise, accurate responses.'
    },
    ...history.filter((entry) =>
      entry && typeof entry.role === 'string' && typeof entry.content === 'string'
    ),
    { role: 'user', content: message }
  ];

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5',
        messages,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[error] OpenAI API request failed:', errorText);
      return res.status(502).json({
        error: 'Failed to fetch response from OpenAI.',
        details: errorText
      });
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || '';

    res.json({
      reply,
      usage: data?.usage || null
    });
  } catch (error) {
    console.error('[error] Unexpected failure while contacting OpenAI:', error);
    res.status(500).json({
      error: 'Unexpected server error.',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Chat backend listening on http://localhost:${PORT}`);
});

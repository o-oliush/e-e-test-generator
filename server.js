const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { OpenAI } = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

const testsDir = path.join(__dirname, 'tests');
const uploadsDir = path.join(__dirname, 'uploads');

for (const dir of [testsDir, uploadsDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${timestamp}-${safeOriginal}`);
  }
});

const upload = multer({ storage });

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const defaultModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';

async function callOpenAI({ systemPrompt, userPrompt }) {
  if (!openai) {
    return {
      content: 'OpenAI API key not configured. Set OPENAI_API_KEY to enable AI responses.'
    };
  }

  const completion = await openai.chat.completions.create({
    model: defaultModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  });

  return completion.choices[0]?.message ?? { content: '' };
}

function extractTitleAndPreview(content) {
  const titleMatch = content.match(/^#\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled Test';
  const preview = content.replace(/\s+/g, ' ').slice(0, 160);
  return { title, preview };
}

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  res.json({
    fileId: req.file.filename,
    originalName: req.file.originalname
  });
});

app.get('/api/tests', async (_req, res) => {
  try {
    const files = await fs.promises.readdir(testsDir);
    const tests = await Promise.all(
      files
        .filter((file) => file.endsWith('.md'))
        .map(async (file) => {
          const fullPath = path.join(testsDir, file);
          const content = await fs.promises.readFile(fullPath, 'utf8');
          const { title, preview } = extractTitleAndPreview(content);
          return {
            fileId: file,
            title,
            preview,
            updatedAt: (await fs.promises.stat(fullPath)).mtime
          };
        })
    );

    tests.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json(tests);
  } catch (error) {
    console.error('Failed to load tests', error);
    res.status(500).json({ error: 'Failed to load tests.' });
  }
});

app.post('/api/message', async (req, res) => {
  const { message, files = [] } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    let promptWithFiles = message;

    for (const file of files) {
      if (!file?.fileId) continue;
      const filePath = path.join(uploadsDir, path.basename(file.fileId));
      if (!fs.existsSync(filePath)) continue;
      const fileBuffer = await fs.promises.readFile(filePath);
      const base64 = fileBuffer.toString('base64');
      const label = file.originalName || file.fileId;
      promptWithFiles += `\n\nAttached file (${label}) base64:\n${base64}`;
    }

    const systemPrompt = 'You are an AI assistant that generates high-quality end-to-end test prompts in Markdown format. Include clear titles and step-by-step instructions.';
    const aiMessage = await callOpenAI({
      systemPrompt,
      userPrompt: promptWithFiles
    });

    const aiContent = aiMessage.content || '';

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-${timestamp}.md`;
    const filePath = path.join(testsDir, filename);
    await fs.promises.writeFile(filePath, aiContent, 'utf8');

    const { title, preview } = extractTitleAndPreview(aiContent);

    res.json({
      response: aiContent,
      savedTest: {
        fileId: filename,
        title,
        preview
      }
    });
  } catch (error) {
    console.error('Failed to process message', error);
    res.status(500).json({ error: 'Failed to process message.' });
  }
});

app.post('/api/tests/:fileId/run', async (req, res) => {
  const safeFile = path.basename(req.params.fileId);
  const testPath = path.join(testsDir, safeFile);

  try {
    const content = await fs.promises.readFile(testPath, 'utf8');
    const systemPrompt = 'You are an AI test executor. Given a Markdown test prompt, simulate running the test and report results.';
    const userPrompt = `Execute or verify the following test prompt:\n\n${content}`;
    const aiMessage = await callOpenAI({ systemPrompt, userPrompt });

    res.json({
      result: aiMessage.content || '',
      test: {
        fileId: safeFile
      }
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Test file not found.' });
    }
    console.error('Failed to run test', error);
    res.status(500).json({ error: 'Failed to run test.' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

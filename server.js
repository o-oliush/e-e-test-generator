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
  const { url, message, files = [] } = req.body || {};

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required.' });
  }

  try {
    const fileContent = [];

    for (const file of files) {
      if (!file?.fileId) continue;
      const filePath = path.join(uploadsDir, path.basename(file.fileId));
      if (!fs.existsSync(filePath)) continue;
      const fileBuffer = await fs.promises.readFile(filePath);
      const base64 = fileBuffer.toString('base64');
      const label = file.originalName || file.fileId;
      fileContent.push(`* ${label} base64:\n${base64}`);
    }

    const aiMessage = await callOpenAI({
      systemPrompt: `
You are an experienced software developer with common sense.
The goal is to write a high-quality prompt for an end-to-end test (using natural language and Markdown format) that reproduces my interactions and verifies the final expected result.

${fileContent.length ? `
Watch the attached video carefully and extract a complete, detailed, step-by-step description of all actions I perform on the website.

Analyze the video frame by frame and list every visible user action:
* All mouse movements, clicks, scrolls, and hovers
* Any filters, dropdowns, or checkboxes interacted with
* Text typed into inputs
* Page loads, transitions, or visible UI updates
* Elements that change visibility or state (like filters applying)

When analyzing the video, if you detect any differences between the video behavior and the current live site’s DOM, prioritize actual live selectors (run a live inspection on the site to extract accurate attributes, class names, roles, and labels).
` : ''}

For each action, include:
* A sequential step number
* The element interacted with (by label, text, or CSS selector if identifiable)
* The purpose or expected effect of the action

After listing all steps, create a ready-to-run prompt that executes the same workflow against the live production site, not staging or local environments.

Do not ask for clarification — assume the video and these instructions contain all context you need.

Include in your answer:
* The URL for the website to test
* The full detailed action list from the video with clear titles
* Any ambiguities or assumptions (e.g., dynamic filters, pagination)
      `.trim(),
      userPrompt: `
Website under test: ${url}

${message ? `
Test steps instructions:
${message}
` : ''}

${fileContent.length ? `
Video files:
${fileContent.join('\n\n')}
` : ''}
      `.trim()
    });

    const aiContent = aiMessage.content || '';

    const safeUrl = url
      .replace(/\W+/g, '-')
      .replace(/(^\W+)|(\W+$)/g, '');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-${safeUrl}-${timestamp}.md`;
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

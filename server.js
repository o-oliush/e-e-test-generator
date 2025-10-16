const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const crypto = require('crypto');
const ffmpegPath = require('ffmpeg-static');
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

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
const defaultModel = process.env.OPENAI_MODEL || 'gpt-5';

function readInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const FRAME_INTERVAL_MS = Math.max(50, readInt(process.env.VIDEO_FRAME_INTERVAL_MS, 100));
const MAX_VIDEO_FRAMES = Math.max(1, readInt(process.env.MAX_VIDEO_FRAMES, 20));
const FRAME_SCALE_WIDTH = Math.max(0, readInt(process.env.VIDEO_FRAME_WIDTH, 640));
const FFMPEG_AVAILABLE = Boolean(ffmpegPath);

function randomSuffix() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureOpenAI() {
  if (!openai) {
    return {
      content:
        'OpenAI API key not configured. Set OPENAI_API_KEY to enable AI responses.'
    };
  }
  return null;
}

function buildOutputText(response) {
  if (!response) return '';
  if (typeof response.output_text === 'string') {
    return response.output_text;
  }

  const segments = [];
  if (Array.isArray(response.output)) {
    for (const item of response.output) {
      if (!item?.content) continue;
      for (const part of item.content) {
        if (typeof part.text === 'string') {
          segments.push(part.text);
        }
      }
    }
  }
  return segments.join('\n');
}

function ensureFfmpegAvailable() {
  if (!FFMPEG_AVAILABLE) {
    throw new Error('FFmpeg binary not found. Install ffmpeg-static to enable frame extraction.');
  }
}

function runFfmpeg(args, options = {}) {
  ensureFfmpegAvailable();

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, args, options);
    const stderr = [];

    ffmpeg.stderr.on('data', (chunk) => {
      stderr.push(chunk.toString());
    });

    ffmpeg.on('error', (error) => {
      reject(error);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        const error = new Error(`FFmpeg exited with code ${code}`);
        error.stderr = stderr.join('');
        reject(error);
      }
    });
  });
}

async function extractVideoFrames({
  filePath,
  outputDir,
  intervalMs = FRAME_INTERVAL_MS,
  maxFrames = MAX_VIDEO_FRAMES,
  scaleWidth = FRAME_SCALE_WIDTH
}) {
  ensureFfmpegAvailable();

  const fps = Math.max(1, Math.round(1000 / Math.max(intervalMs, 1)));
  const filters = [`fps=${fps}`];
  if (scaleWidth > 0) {
    filters.push(`scale=${scaleWidth}:-1:flags=lanczos`);
  }

  const outputPattern = path.join(outputDir, 'frame-%04d.jpg');
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    filePath,
    '-vf',
    filters.join(','),
    '-vframes',
    String(maxFrames),
    '-qscale:v',
    '2',
    outputPattern
  ];

  await runFfmpeg(args);

  const files = await fs.promises.readdir(outputDir);
  return files
    .filter((file) => file.toLowerCase().endsWith('.jpg'))
    .sort()
    .map((file) => path.join(outputDir, file));
}

async function uploadImageToOpenAI(framePath) {
  if (!openai) return null;

  const stream = fs.createReadStream(framePath);
  const uploaded = await openai.files.create({
    purpose: 'vision',
    file: stream
  });

  return uploaded;
}

async function prepareVideoFramesForOpenAI({ filePath, label }) {
  ensureFfmpegAvailable();

  const tempDirPrefix = path.join(uploadsDir, `frames-${randomSuffix()}-`);
  const framesDir = await fs.promises.mkdtemp(tempDirPrefix);

  try {
    const framePaths = await extractVideoFrames({
      filePath,
      outputDir: framesDir
    });

    const uploads = [];
    let index = 0;
    for (const framePath of framePaths) {
      try {
        const uploaded = await uploadImageToOpenAI(framePath);
        if (uploaded?.id) {
          uploads.push({
            id: uploaded.id,
            label: `${label} frame ${String(++index).padStart(2, '0')}`
          });
        }
      } catch (error) {
        console.error('Failed to upload video frame to OpenAI', error);
      }
    }

    return { uploads, extractedFrames: framePaths.length };
  } finally {
    await fs.promises.rm(framesDir, { recursive: true, force: true });
  }
}

async function callOpenAI({ systemPrompt, userPrompt, images = [] }) {
  const missingClient = ensureOpenAI();
  if (missingClient) {
    return missingClient;
  }

  const userContent = [{ type: 'input_text', text: userPrompt }];

  if (Array.isArray(images) && images.length > 0) {
    for (const image of images) {
      if (!image?.id) continue;
      userContent.push({
        type: 'input_image',
        image: { file_id: image.id }
      });
    }
  }

  const input = [
    {
      role: 'system',
      content: [{ type: 'input_text', text: systemPrompt }]
    },
    {
      role: 'user',
      content: userContent
    }
  ];

  const response = await openai.responses.create({
    model: defaultModel,
    input
  });

  return { content: buildOutputText(response) };
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
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size
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
    const images = [];

    for (const file of files) {
      if (!file?.fileId) continue;
      const filePath = path.join(uploadsDir, path.basename(file.fileId));
      if (!fs.existsSync(filePath)) continue;
      const label = file.originalName || file.fileId;
      const isVideo = (file.mimeType || '').startsWith('video/');

      if (isVideo) {
        if (!openai) {
          promptWithFiles += `\n\nVideo (${label}) cannot be processed because the OpenAI API is not configured.`;
          continue;
        }

        if (!FFMPEG_AVAILABLE) {
          promptWithFiles += `\n\nVideo (${label}) cannot be processed because FFmpeg is unavailable on the server.`;
          continue;
        }

        try {
          const { uploads, extractedFrames } = await prepareVideoFramesForOpenAI({
            filePath,
            label
          });

          if (uploads.length > 0) {
            images.push(...uploads);
            promptWithFiles += `\n\nExtracted ${uploads.length} frame(s) from video (${label}) at ~${FRAME_INTERVAL_MS}ms intervals for analysis.`;
            if (extractedFrames > uploads.length) {
              const failed = extractedFrames - uploads.length;
              promptWithFiles += ` ${failed} frame(s) could not be uploaded.`;
            }
          } else if (extractedFrames === 0) {
            promptWithFiles += `\n\nVideo (${label}) did not produce any frames for analysis.`;
          } else {
            promptWithFiles += `\n\nVideo (${label}) frames could not be uploaded to OpenAI. Please retry or provide a textual summary instead.`;
          }
        } catch (error) {
          console.error('Failed to process video for OpenAI', error);
          const reason = error?.message ? ` (${error.message})` : '';
          promptWithFiles += `\n\nVideo (${label}) could not be processed for analysis${reason}.`;
        }

        continue;
      }

      const fileBuffer = await fs.promises.readFile(filePath);
      const base64 = fileBuffer.toString('base64');
      if (base64.length > 200000) {
        promptWithFiles += `\n\nFile (${label}) is too large to inline safely. Please reduce its size or provide a summary instead of the raw contents.`;
        continue;
      }
      promptWithFiles += `\n\nAttached file (${label}) base64:\n${base64}`;
    }

    const systemPrompt = 'You are an AI assistant that generates high-quality end-to-end test prompts in Markdown format. Include clear titles and step-by-step instructions.';
    const aiMessage = await callOpenAI({
      systemPrompt,
      userPrompt: promptWithFiles,
      images
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

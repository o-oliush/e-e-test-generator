const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

let ffmpegChecked = false;
let ffmpegAvailable = false;

function resolveFfmpegPath(customPath) {
  if (customPath && typeof customPath === 'string') {
    return customPath;
  }
  if (process.env.FFMPEG_PATH) {
    return process.env.FFMPEG_PATH;
  }
  return 'ffmpeg';
}

function ensureFfmpegAvailable(ffmpegPath) {
  if (!ffmpegChecked) {
    try {
      const result = spawnSync(ffmpegPath, ['-version'], { stdio: 'ignore' });
      ffmpegAvailable = result.status === 0;
    } catch (error) {
      ffmpegAvailable = false;
    }
    ffmpegChecked = true;
  }

  if (!ffmpegAvailable) {
    throw new Error('FFmpeg binary not found. Install FFmpeg and/or set the FFMPEG_PATH environment variable.');
  }
}

async function runFfmpeg({ inputPath, outputPattern, fps, ffmpegPath }) {
  return new Promise((resolve, reject) => {
    const ffmpegArgs = ['-y', '-i', inputPath, '-vf', `fps=${fps}`, outputPattern];
    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
    let errorOutput = '';

    if (ffmpegProcess.stderr) {
      ffmpegProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
    }

    ffmpegProcess.on('error', (error) => {
      reject(error);
    });

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${errorOutput}`));
      }
    });
  });
}

async function extractVideoFrames({ inputPath, frameIntervalMs = 100, ffmpegPath: customFfmpegPath } = {}) {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new Error('inputPath is required to extract video frames.');
  }

  if (typeof frameIntervalMs !== 'number' || !Number.isFinite(frameIntervalMs) || frameIntervalMs <= 0) {
    throw new Error('frameIntervalMs must be a positive number.');
  }

  const ffmpegPath = resolveFfmpegPath(customFfmpegPath);
  ensureFfmpegAvailable(ffmpegPath);

  try {
    await fs.promises.access(inputPath, fs.constants.R_OK);
  } catch (error) {
    throw new Error(`Video file not found or not readable at path: ${inputPath}`);
  }

  const framesDirPrefix = path.join(os.tmpdir(), 'video-frames-');
  const framesDir = await fs.promises.mkdtemp(framesDirPrefix);
  const framePattern = path.join(framesDir, 'frame-%05d.png');
  const fps = Number((1000 / frameIntervalMs).toFixed(3));

  try {
    await runFfmpeg({ inputPath, outputPattern: framePattern, fps, ffmpegPath });

    const files = (await fs.promises.readdir(framesDir))
      .filter((fileName) => fileName.toLowerCase().endsWith('.png'))
      .sort();

    const frames = [];
    for (const [index, fileName] of files.entries()) {
      const filePath = path.join(framesDir, fileName);
      const buffer = await fs.promises.readFile(filePath);
      frames.push({
        index,
        timestampMs: index * frameIntervalMs,
        mimeType: 'image/png',
        data: buffer.toString('base64')
      });
    }

    return frames;
  } finally {
    await fs.promises.rm(framesDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = {
  extractVideoFrames,
  _internal: {
    resolveFfmpegPath,
    ensureFfmpegAvailable,
  }
};

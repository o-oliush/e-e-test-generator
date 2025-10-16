/**
 * Example: Use GPT-4o for video understanding via extracted frames.
 *
 * Prerequisites:
 *   npm install openai fluent-ffmpeg ffmpeg-static ffprobe-static
 *   export OPENAI_API_KEY="sk-..."
 */

import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import OpenAI from "openai";

// Set the ffmpeg and ffprobe paths to use the static binaries
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

/**
 * Extract N evenly spaced frames from a video file using ffmpeg
 */
export async function extractFrames(videoPath, outputDir, frameCount = 5) {
  return new Promise((resolve, reject) => {
    try {
      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Check if video file exists
      if (!fs.existsSync(videoPath)) {
        reject(new Error(`Video file not found: ${videoPath}`));
        return;
      }

      // Clear any existing frame files in the output directory
      const existingFiles = fs.readdirSync(outputDir)
        .filter(file => file.startsWith('frame-') && file.endsWith('.jpg'));
      existingFiles.forEach(file => {
        fs.unlinkSync(path.join(outputDir, file));
      });

      console.log(`🎬 Extracting ${frameCount} frames from ${videoPath}...`);

      // Create unique timestamp for this extraction session
      const timestamp = Date.now();
      const uniquePrefix = `frame-${timestamp}`;

      ffmpeg(videoPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg command: ' + commandLine);
        })
        .on('progress', (progress) => {
          console.log(`Processing: ${progress.percent ? Math.round(progress.percent) : 0}% done`);
        })
        .on('end', () => {
          // Get all generated frame files with the unique prefix
          const frames = fs.readdirSync(outputDir)
            .filter(file => file.startsWith(uniquePrefix) && file.endsWith('.jpg'))
            .map(file => path.join(outputDir, file))
            .sort();
          
          console.log(`✅ Successfully extracted ${frames.length} frames`);
          resolve(frames);
        })
        .on('error', (error) => {
          console.error('❌ FFmpeg error:', error);
          reject(new Error(`FFmpeg failed: ${error.message}`));
        })
        .screenshots({
          count: frameCount,
          folder: outputDir,
          filename: `${uniquePrefix}-%i.jpg`,
          size: '640x480'
        });

    } catch (error) {
      console.error('❌ Error in extractFrames:', error);
      reject(error);
    }
  });
}

/**
 * Send the extracted frames + text prompt to GPT-4o
 */
export async function askAboutFrames(openaiClient, framePaths, promptText) {
  try {
    console.log(`🧠 Analyzing ${framePaths.length} frames with OpenAI...`);
    
    // Prepare image inputs for OpenAI vision API
    const imageInputs = framePaths.map((filePath) => ({
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,${fs.readFileSync(filePath, 'base64')}`
      }
    }));

    // Create the message content with text and images
    const content = [
      { type: "text", text: promptText },
      ...imageInputs
    ];

    const response = await openaiClient.chat.completions.create({
      model: "gpt-5", // or "gpt-4o"
      messages: [
        {
          role: "user",
          content: content
        }
      ]
    });

    const result = response.choices[0].message.content;
    console.log("🧠 Model output:");
    console.log(result);
    return result;
    
  } catch (error) {
    console.error('❌ Error in askAboutFrames:', error);
    throw new Error(`OpenAI analysis failed: ${error.message}`);
  }
}

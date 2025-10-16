# AI-Powered Test Generator Prototype

This project demonstrates a lightweight full-stack workflow for generating and running AI-assisted end-to-end test prompts using Markdown files as the storage format.

## Features

- 📁 Upload contextual video or supporting files that will be forwarded to the AI when requesting new prompts. Video uploads are
  converted into JPEG frame samples (every ~100 ms, up to 20 frames by default, scaled to 640 px wide) via the bundled FFmpeg
  binary and each frame is uploaded to OpenAI with the `vision` purpose so GPT-5 can inspect them as standard `input_image`
  attachments.
- 💬 Send free-form instructions to OpenAI's API to generate detailed Markdown test plans.
- 🗂️ Persist AI-generated prompts as Markdown files within the local `tests/` directory and list them in the UI.
- ▶️ Run any stored test prompt by resending it to the AI for simulated execution or verification.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Provide an OpenAI API key in your environment:
   ```bash
   export OPENAI_API_KEY="sk-your-key"
   # Optional: override the default model used for analysis
   export OPENAI_MODEL="gpt-5"
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open `http://localhost:3000` in your browser and interact with the interface.

## Project Structure

```
public/        # Static frontend assets (HTML, CSS, JS)
server.js      # Express server exposing upload, message, and test APIs
tests/         # Markdown files representing stored test prompts
uploads/       # Temporary storage for uploaded files (gitignored)
```

## Notes

- AI interactions require valid OpenAI credentials. When the API key is missing, the server responds with an explanatory message and still stores the generated files.
- Uploaded files are encoded to base64 and appended to the user prompt when calling the AI, ensuring the model can reference them without additional hosting infrastructure. Oversized attachments are skipped to avoid excessive token consumption.
- Uploaded videos are sampled into a bounded set of frames that are uploaded to OpenAI as vision images and referenced as `input_image` content parts, keeping GPT-5 requests within supported media formats while still conveying motion cues.

### Video frame extraction controls

- `VIDEO_FRAME_INTERVAL_MS` — target spacing between sampled frames (default: `100`).
- `MAX_VIDEO_FRAMES` — maximum number of frames to extract per uploaded video (default: `20`).
- `VIDEO_FRAME_WIDTH` — optional width to scale frames to before upload (default: `640`, set to `0` to keep the original resolution).

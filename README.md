# AI-Powered Test Generator Prototype

This project demonstrates a lightweight full-stack workflow for generating and running AI-assisted end-to-end test prompts using Markdown files as the storage format.

## Features

- 📁 Upload contextual video or supporting files that will be forwarded to the AI when requesting new prompts.
- 🎞️ Large videos are automatically split into 100 ms PNG frames and included in requests without exceeding attachment limits.
- 💬 Send free-form instructions to OpenAI's API to generate detailed Markdown test plans.
- 🗂️ Persist AI-generated prompts as Markdown files within the local `tests/` directory and explore them on the dedicated Stored Test Prompts page.
- ▶️ Run any stored test prompt by resending it to the AI for simulated execution or verification.
- 📊 Review pass/fail status, confidence, and execution logs directly from the Stored Test Prompts page with inline analyzer summaries.
- 🕓 Inspect a persisted execution history for every test, stored under `test-results/` so you can revisit previous attempts.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Provide an OpenAI API key in your environment:
   ```bash
   export OPENAI_API_KEY="sk-your-key"
   # Optional: override the default model
   export OPENAI_MODEL="gpt-4o-mini"
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open `http://localhost:3000` in your browser and interact with the interface.
   - Use the navigation bar to jump between the generator and the Stored Test Prompts page (or visit `/tests.html`) to review saved prompts, expand their Markdown, and run them.

## Project Structure

```
public/        # Static frontend assets (HTML, CSS, JS)
server.js      # Express server exposing upload, message, and test APIs
tests/         # Markdown files representing stored test prompts
uploads/       # Temporary storage for uploaded files (gitignored)
test-results/  # JSONL files capturing run history per test prompt
```

## Notes

- AI interactions require valid OpenAI credentials. When the API key is missing, the server responds with an explanatory message and still stores the generated files.
- Uploaded files are encoded to base64 and appended to the user prompt when calling the AI, ensuring the model can reference them without additional hosting infrastructure.
- Video uploads are processed on the server with FFmpeg; frames are streamed back to the browser and relayed to the AI alongside other attachments.

# Playwright Test Generator (VS Code Extension)

Generate Playwright tests from a browser screen recording or a text description.

## Quick Start

1. **Prerequisites**
   - Node.js 18+
   - VS Code 1.85+
   - (Optional for video path) Python 3 + Tesseract (for Phase 2)

2. **Install deps & build**
   ```bash
   npm install
   npm run compile
   ```

3. **Launch Extension**

   * Open this folder in VS Code.
   * Press `F5` to debug (launches the Extension Development Host).
   * Run command: **TestGen: Generate Playwright Test from Text**
   * Try: *"Go to http://localhost:3000, click Login, fill Email with user@example.com, fill Password with secret, click Submit,
 expect Welcome"*

4. **Output**

   * The test is written to `tests/generated_test.spec.ts` and opened in the editor.

## Settings

* `testgen.pythonPath`: Python executable (default `python3`).
* `testgen.videoProcessorPath`: Path to `video_processor.py` (Phase 2).
* `testgen.outputDir`: Folder to write tests (default `tests`).
* `testgen.baseUrl`: Used if no navigation is detected.

## Next Steps (Phase 2)

* Add `video_processor.py` with FFmpeg + OCR to emit actions JSON.
* Enhance text parser with an LLM or a proper grammar.
* Add Git/PR automation via `simple-git` or GitHub CLI.
* Optional: Validate selectors by launching Playwright in headless mode.

---

# GPT-5 Chat Web App

This repository also includes a minimal web chat that uses the OpenAI API (GPT-5) through a small Express backend. The UI is intentionally lightweight so you can quickly test messaging with ChatGPT locally.

## Project Structure

```
backend/   # Express server that proxies requests to OpenAI
frontend/  # Static HTML/CSS/JS chat interface
```

## Prerequisites

* Node.js 18+ (for native `fetch` support)
* An OpenAI API key with access to the GPT-5 model (`OPENAI_API_KEY` environment variable)

## Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env and replace the placeholder key
npm install
npm start
```

By default the backend listens on <http://localhost:3001>. The `/api/chat` endpoint accepts a JSON payload:

```json
{
  "message": "Hello!",
  "history": [
    { "role": "user", "content": "Hi" },
    { "role": "assistant", "content": "Hello there!" }
  ]
}
```

It forwards the request to OpenAI and returns the assistant reply and token usage.

## Frontend Setup

The frontend is a static site that can be opened directly or served via a lightweight static server.

```bash
# Option 1: open the file directly
open frontend/index.html

# Option 2: serve with npm (recommended to avoid CORS issues)
npx serve frontend
# Visit the printed URL (defaults to http://localhost:3000)
```

When served from another origin (e.g. `http://localhost:3000`), the page sends requests to the backend using a relative `/api/chat` path, so make sure to proxy or serve the frontend from the same origin in production. When opened directly from the filesystem (`file://`), the script falls back to calling `http://localhost:3001/api/chat`.

## Environment Variables

| Name             | Required | Description                                       |
| ---------------- | -------- | ------------------------------------------------- |
| `OPENAI_API_KEY` | Yes      | API key issued by OpenAI for GPT-5 access.       |
| `PORT`           | No       | Override the backend port (defaults to `3001`).  |

## Development Notes

* The backend adds a default system prompt to keep responses concise.
* Errors from the OpenAI API are surfaced in the backend logs and returned to the client.
* The frontend keeps a local history so the conversation context is preserved between turns.

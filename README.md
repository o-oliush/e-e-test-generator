# AI-Powered Test Generator Prototype

This project demonstrates a lightweight full-stack workflow for generating and running AI-assisted end-to-end test prompts using Markdown files as the storage format.

## Features

- 📁 Upload contextual video or supporting files that will be forwarded to the AI when requesting new prompts. Video uploads are
  streamed to OpenAI's Files API so large assets can be analyzed without inlining them in requests.
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
- Uploaded files are encoded to base64 and appended to the user prompt when calling the AI, ensuring the model can reference them without additional hosting infrastructure.
- Uploaded videos are instead streamed directly to OpenAI's file storage and attached to the `responses.create` call as video inputs, allowing the assistant to analyze large media assets without inflating request payload sizes.

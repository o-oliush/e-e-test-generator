# GPT-5 Chat Web App

A minimal full-stack project that serves a lightweight chat interface connected to OpenAI's GPT-5 model through the official API.

## Prerequisites

- Node.js 18 or newer
- An OpenAI API key with access to GPT-5 (set as `OPENAI_API_KEY`)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure your OpenAI API key (choose one):

   - **Using a local `.env` file (recommended for Windows):**

     ```powershell
     Copy-Item .env.example .env
     notepad .env  # replace the placeholder with your real key
     ```

     If `Copy-Item` is unavailable, you can create the file manually with the contents from `.env.example`. Make sure the `.env` file lives in the project root (next to `package.json`) so the server can load it automatically when it starts.

   - **Exporting an environment variable:**

     macOS/Linux:

     ```bash
     export OPENAI_API_KEY="sk-your-key"
     ```

     Windows PowerShell (sets the variable for future terminals):

     ```powershell
     setx OPENAI_API_KEY "sk-your-key"
     ```
     After running `setx`, open a new terminal so the environment variable is available.

3. Start the server:

   ```bash
   npm start
   ```

4. Open your browser at [http://localhost:3000](http://localhost:3000) to chat with GPT-5.

## Project structure

```
├── public/           # Static frontend assets
│   └── index.html    # Minimal chat UI
├── server/
│   └── index.js      # Express server + OpenAI proxy
├── package.json
└── README.md
```

## Development

- Use `npm run dev` to start the server with automatic reloads via `nodemon`.

## Environment variables

- `OPENAI_API_KEY` (required): Your API key from the OpenAI platform. The server reads it from the environment or a local `.env` file.
- `PORT` (optional): Override the default server port of 3000.

## Notes

- This project intentionally keeps the frontend and backend simple and framework-free for ease of understanding.
- Conversation history is maintained on the client and sent with each request to provide context to GPT-5.
- `.env` is listed in `.gitignore`, so your local API keys stay out of version control.

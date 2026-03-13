# Immersion AI

Modern RP interface powered by local LLMs.

## Features

- **Chat** — streaming responses, message editing/deletion, auto-titles
- **Characters** — create, edit, import (PNG cards), AI-powered character wizard
- **Lorebooks** — world info with keyword-based injection
- **Scenarios** — AI-generated RP scenarios
- **LLM Server** — built-in KoboldCpp management (start/stop, model selection)

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + Zustand
- **Backend**: TypeScript + Express
- **LLM**: KoboldCpp (local GGUF models)

## Quick Start

```bash
# Install dependencies
npm install
cd server && npm install
cd ../client && npm install

# Start with PM2
pm2 start ecosystem.config.cjs

# Or start manually
cd server && npm run dev   # Backend on :4777
cd client && npm run dev   # Frontend on :4778
```

Open http://localhost:4778

## License

AGPL-3.0

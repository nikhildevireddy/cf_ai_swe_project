# Cloudflare AI Chatbot

This project demonstrates an **AI-powered application** built on **Cloudflare Workers** that uses **Workers AI** (Llama 3.3 Instruct), **Durable Objects** for workflow coordination and memory, and a **simple chat UI** for user interaction.

## Overview

The application implements a generative chatbot capable of maintaining conversational context across turns. It runs fully on Cloudflare’s edge platform using serverless components.

### Key Components
- **LLM (Workers AI)**  
  Uses the model `@cf/meta/llama-3.3-70b-instruct-fp8-fast` via the `AI` binding in `wrangler.jsonc` to process and generate responses.
- **Workflow / Coordination (Durable Object)**  
  A `SessionDO` Durable Object coordinates conversation flow, calling the model, maintaining message history, and mirroring it to KV.
- **User Input (Chat UI)**  
  A lightweight HTML + JavaScript frontend served by the Worker allows users to type messages and view replies in real time.
- **Memory / State (Durable Object + KV)**  
  Conversation history is stored persistently in the Durable Object, with snapshots mirrored in a KV namespace for resilience.

## Project Structure

```
├── src/
│   └── worker.ts          # Main Worker + Durable Object logic
├── public/
│   └── index.html         # Simple chat UI served by the Worker
├── wrangler.jsonc         # Cloudflare configuration (AI, DO, KV bindings)
├── package.json           # Dependencies and npm scripts
└── README.md
```

## Prerequisites

- Node 18+  
- Cloudflare Wrangler v3.89.0 or later  
- A Cloudflare account with Workers AI and Durable Objects enabled

## Installation

```bash
git clone https://github.com/your-username/cf_ai_swe_project.git
cd cf_ai_swe_project
npm install
```

## Running Locally

Run the Worker in local development mode with persistent Durable Object state:

```bash
npx wrangler dev --local --persist-to ./wrangler-state
```

Then open the URL shown in the console (e.g. <http://127.0.0.1:8787>) in your browser.

## Deploying to Cloudflare

```bash
npx wrangler deploy
```

This deploys:
- the Worker logic (`src/worker.ts`)
- the Durable Object (`SessionDO`)
- the KV namespace (`CHAT_KV`)
- the `AI` binding for Workers AI

## How It Works

1. **Frontend**  
   The chat UI sends messages to `/api/chat`.
2. **Worker (Backend)**  
   - Receives the message.  
   - Forwards it to the `SessionDO` Durable Object associated with the session ID.
3. **Durable Object (Coordinator)**  
   - Loads previous conversation history.  
   - Calls the **LLM** (Llama 3.3 Instruct) using `env.AI.run(...)`.  
   - Stores the user message and model reply persistently.  
   - Returns the model’s response to the frontend.
4. **Memory Persistence**  
   - The DO keeps a full session log in its internal storage.  
   - Each update is mirrored into **KV** as a backup snapshot.

## Testing Components Individually

- **Chat UI:**  
  Open `/` in your browser after running `wrangler dev`.
- **Worker API:**  
  Use `curl` to test directly:
  ```bash
  curl -X POST "http://127.0.0.1:8787/api/chat" \
    -H "Content-Type: application/json" \
    -d '{"sessionId":"test","message":"Hello!"}'
  ```
- **Durable Object:**  
  Use Wrangler Tail to view logs and confirm message persistence:
  ```bash
  npx wrangler tail
  ```

## Requirements Fulfillment

| Requirement | Implementation |
|--------------|----------------|
| **LLM** | Cloudflare Workers AI — Llama 3.3 70B Instruct |
| **Workflow / Coordination** | Durable Object (`SessionDO`) manages chat flow |
| **User Input** | Browser chat UI (HTML + JS) |
| **Memory / State** | DO persistent storage + KV namespace backup |
<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1-73WjYkWmwZZLqaEGJ3mLvX4sx5TrDVX

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## Backend service (Xi'an pilot)

A new backend orchestrator service has been added under `server/` as a first step for migrating model calls from frontend to backend and extending MCP integrations.

1. Install dependencies:
   `npm install`
2. Start backend:
   `npm run dev:server`
3. Start frontend in another terminal:
   `npm run dev`

Frontend now routes planning requests to `http://localhost:8787/api/plan` only (provider calls are centralized on backend).


### Backend env

Set provider keys on server side (frontend no longer stores provider keys):

- `GEMINI_API_KEY` (or `API_KEY`)
- `DEEPSEEK_API_KEY`
- `ZHIPU_API_KEY`

Optional runtime controls:

- `REQUEST_TIMEOUT_MS` (default `20000`)
- `MAX_RETRIES` (default `2`)

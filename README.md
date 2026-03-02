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

By default frontend will call `http://localhost:8787/api/plan` first, then fallback to direct provider calls if backend is unavailable.

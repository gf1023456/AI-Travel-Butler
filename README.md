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
2. Copy `server/config.example.json` to `server/config.json` and fill provider keys
3. Run backend and frontend:
   `npm run dev:server` (backend)
   `npm run dev` (frontend)


## Backend service (Xi'an pilot)

A new backend orchestrator service has been added under `server/` as a first step for migrating model calls from frontend to backend and extending MCP integrations.

1. Install dependencies:
   `npm install`
2. Start backend:
   `npm run dev:server`
3. Start frontend in another terminal:
   `npm run dev`

Frontend now routes planning requests to `http://localhost:8787/api/plan` only (provider calls are centralized on backend).


### Backend config file

Server reads configuration from `server/config.json` (frontend no longer stores provider keys).

- Copy `server/config.example.json` to `server/config.json`
- Fill `providers.geminiApiKey` / `providers.deepseekApiKey` / `providers.zhipuApiKey`
- Tune runtime values under `server`, `rag`, `rollout`, `performance` sections


### New backend endpoints

- `POST /api/plan` : generate initial itinerary
- `POST /api/plan/refine` : refine an existing plan with new instructions
- `GET /api/knowledge/search?q=...` : inspect local RAG retrieval results
- `GET /api/metrics` : service-level counters and provider usage
- `GET /api/execution-log/:id` : fetch a persisted execution log by `execution_log_id`
- `GET /api/alerts` : list runtime alerts (rollback/cost threshold)
- `GET /api/release/status` : inspect canary/rollback runtime config

### Local knowledge base (RAG MVP)

- Seed data file: `knowledge/processed/chunks.jsonl`
- Configure via `KNOWLEDGE_FILE` and `RAG_TOP_K`


### Verifier + MCP enrichment (current)

`POST /api/plan` responses now include:
- `verifierWarnings`: lightweight schedule checks (e.g. too few POIs / duplicate sequence)
- MCP-enriched fields on POI items (`weather_*`, `transit_hint`, `source`, `confidence`) when provider output is incomplete.


### Release + cost controls

Configure in `server/config.json`:
- `rollout.enableCanary`
- `rollout.canaryPercent`
- `rollout.primaryProvider` / `rollout.canaryProvider`
- `rollout.autoRollbackOnFailure`
- `performance.cacheTtlMs`
- `performance.costAlertThreshold`

You can also set `modelType` to `auto` in request payload to use backend rollout strategy.


### Map-point fallback behavior

If a provider returns only social recommendations and no `location` tool calls, backend will synthesize minimal map points from social recommendations to keep map/export/history features usable. Trace key: `fallback:<provider>:social_to_location:*`.

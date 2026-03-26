# Technical Documentation — अमृत सरकारी योजना पोर्टल Voice Bot

## System Overview

This project is a full-stack AI voice assistant for government scheme support.

Two runtime modes:
- **Web demo mode:** browser mic + Gemini Live via backend WS proxy.
- **Plivo phone mode:** outbound call + telephony audio bridge via backend.

## Key Modules

### Frontend
- `App.tsx` — UI and session lifecycle.
- `services/liveClient.ts` — Gemini live session, audio stream, transcript handling, per-turn context injection.
- `services/transcriptSanitizer.ts` — Devanagari-aware transcript cleanup.
- `components/TranscriptBubble.tsx`, `components/Visualizer.tsx` — conversation UI.

### Conversation Engine
- `services/conversationEngine/prompts.ts` — prompt/persona/language/response rules.
- `services/conversationEngine/retrieval.ts` — top-match retrieval with fuzzy Devanagari handling.
- `services/conversationEngine/index.ts` — instruction orchestration.

### Backend
- `backend/server.ts` — REST/WS server, Plivo webhooks, Gemini WS proxy.
- `backend/knowledge/schemeCatalog.ts` — runtime parser for `scheme_description.json`.
- `backend/twilio/mediaStream.ts` — phone audio bridge + UI sync.
- `backend/api/knowledgeBaseRoutes.ts` — KB refresh/status/stats/data APIs.

## Data Model Notes

`Scheme` now includes:
- core identity: `id`, `nameMr`, `nameHi`, `nameEn`, `category`
- rich content: `description`, `benefits`, `documentsRequired`, `applicationProcess`
- support fields: `officialWebsite`, `helplineNumber`, `schemeStartDate`, `applicationDeadline`

## Audio/Latency Notes

- Client uses tuned VAD and lightweight noise gate.
- False interruption protection + manual barge-in handling.
- Greeting re-trigger on slow start.
- Query-aware context injection to reduce irrelevant model reasoning.

## Deployment Notes

- Backend serves `dist/` for single-port deployment.
- Requires Node.js 20+.
- For phone mode, `BACKEND_BASE_URL` must be public (ngrok/Railway).
- Gemini key must exist in backend env (`GEMINI_API_KEY` or `API_KEY`).

## Security and Operations

- API auth/rate limits are not yet enforced.
- Runtime state is in-memory.
- Logs are written to `backend/logs/logs.txt`.

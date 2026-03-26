# PROJECT_DOCUMENTATION.md — अमृत सरकारी योजना पोर्टल Voice Bot

## 1. Project Purpose

AI voice assistant to help users with government scheme information in Marathi-first conversational flow.

## 2. Primary Capabilities

- Web demo voice assistant with live transcript
- Outbound Plivo call support
- Scheme retrieval from local JSON knowledge source
- Eligibility guidance, documents, process, and contact fields
- Transcript export (CSV/PDF)

## 3. Runtime Modes

1. **Web demo** (`App.tsx` + `LiveClient`)
2. **Phone mode** (`/api/call` + `/media` bridge)

## 4. Architecture

- Frontend: React + Vite
- Backend: Express + ws
- AI runtime: Gemini Live through backend WS proxy
- Telephony: Plivo webhooks + media stream

## 5. Core Directories

- `backend/` — server, APIs, telephony bridge, knowledge loader
- `services/` — live client, prompts, retrieval, sanitizer
- `components/` — UI widgets
- `docs/` — project documentation

## 6. Source of Truth Data

- `scheme_description.json` (root)

Parsed by:
- `backend/knowledge/schemeCatalog.ts`

## 7. Key API Endpoints

- `POST /api/call`
- `POST /api/translate`
- `GET /api/schemes*`
- `POST /api/schemes/:id/check-eligibility`
- `POST /api/knowledge-base/update`
- `GET /health`

## 8. WebSocket Endpoints

- `/media` (Plivo audio bridge)
- `/ui-sync` (UI event stream)
- `/ws/google.ai.generativelanguage.<version>.GenerativeService.BidiGenerateContent` (Gemini proxy)

## 9. Prompt and Retrieval Pipeline

- Prompt policy: Marathi-first, concise, scheme-only domain
- Retrieval: top-match shortlist from runtime scheme set
- Per-user-turn context injection for better relevance and reduced drift
- Fuzzy handling for split Devanagari ASR

## 10. Audio Pipeline Highlights

- VAD tuned for latency/reliability tradeoff
- noise/echo filtering in live client
- barge-in handling to avoid stale response overlap

## 11. Current UI Scope

- AI chatbot card
- Start/End web demo control
- Live Trail transcript panel
- CSV/PDF export controls

## 12. Environment

Required:
- `GEMINI_API_KEY` or `API_KEY`

Phone mode:
- `PLIVO_AUTH_ID`
- `PLIVO_AUTH_TOKEN`
- `PLIVO_NUMBER`
- `BACKEND_BASE_URL`

## 13. Build and Run

```bash
npm install
npm run backend
npm run dev
```

Production style:
```bash
npm run start
```

## 14. Testing

```bash
npm run test:run
npm run build
```

## 15. Logging and Observability

- Backend logs: `backend/logs/logs.txt`
- UI transcript trail for runtime behavior inspection

## 16. Known Limitations

- In-memory runtime context/log state
- No API auth/rate limiting
- Some migration-era docs in `files/` are historical references only

## 17. Security Notes

- Do not commit real secrets in `.env*`
- Restrict public deployment without auth controls

## 18. Migration Status (Medical -> Scheme Bot)

- Active runtime is scheme-domain only
- Marathi-first prompt behavior active
- Legacy medical docs/code references removed from active docs

## 19. Practical QA Checklist

- Agent greets first in Marathi
- Scheme name recognition (including split ASR input)
- Contact/date/docs responses when fields exist in data
- No duplicate greeting
- No stale previous-answer overlap on barge-in

## 20. Extension Opportunities

- Persistent DB for sessions/analytics
- Auth + rate limiting
- deterministic resolver path for high-confidence scheme ID lookups

## 21. Dependencies (High-Level)

- `@google/genai`
- `express`
- `ws`
- `react`
- `vite`
- `tsx`

## 22. Documentation Index

- `README.md`
- `docs/API_DOCUMENTATION.md`
- `docs/TECHNICAL_DOCUMENTATION.md`
- `docs/PROMPTS_REFERENCE.md`
- `docs/PROJECT_FLOW.md`

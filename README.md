# अमृत सरकारी योजना पोर्टल Voice Bot

Marathi-first AI voice assistant for government scheme guidance, with both web demo and Plivo phone runtime paths.

## What It Does

- Starts every session in Marathi, switches to Hindi/English only when user asks.
- Answers scheme queries from `scheme_description.json` (eligibility, documents, process, contacts).
- Runs in:
  - Web demo mode (browser mic to Gemini via backend WS proxy)
  - Plivo outbound call mode (`/api/call` + `/media` bridge)
- Shows live transcript in UI and supports transcript export (CSV/PDF).
- Supports KB refresh and normalized snapshot APIs under `/api/knowledge-base`.

## Tech Stack

- Frontend: React 19, Vite, Tailwind CSS v4
- Backend: Express 4, `ws`, `tsx`
- AI: Google Gemini Live (`gemini-2.5-flash-native-audio-preview-09-2025`)
- Telephony: Plivo (voice + SMS)
- Testing: Vitest

## Current Product Behavior

- Portal identity: `अमृत सरकारी योजना पोर्टल`
- Default agent: Priya (`Aoede`) / optional Rajesh (`Puck`)
- UI is web-demo focused (AI chatbot panel + Live Trail transcript)
- Retrieval pipeline:
  - runtime schemes loaded from backend
  - fuzzy matching for split Devanagari ASR tokens
  - top-match context injection per user query for faster, relevant answers

## Environment Variables

Backend loads env in this order:
1. root `.env`
2. root `.env.local`
3. `backend/.env`

Typical setup:

```env
PLIVO_AUTH_ID=MAxxxxxxxxxxxxxxxxxx
PLIVO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PLIVO_NUMBER=+919876543210
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxx
GEMINI_LIVE_MODEL=gemini-2.5-flash-native-audio-preview-09-2025
BACKEND_BASE_URL=https://xxxx.ngrok-free.app
ORGANIZATION_NAME=अमृत सरकारी योजना पोर्टल
PORT=3001
```

Notes:
- `GEMINI_API_KEY` (or `API_KEY`) is required for backend Gemini WS proxy.
- `BACKEND_BASE_URL` must be public for Plivo callbacks.
- Browser demo does **not** expose API keys directly; frontend uses backend proxy path.

## Local Run

```bash
npm install
```

Terminal 1:
```bash
npm run backend
```

Terminal 2:
```bash
npm run dev
```

For phone-call testing, expose backend:
```bash
ngrok http 3001
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Frontend dev server |
| `npm run backend` | Start backend |
| `npm run backend:dev` | Backend with watch |
| `npm run build` | Production build |
| `npm run start` | Build + start backend |
| `npm run test` | Vitest watch |
| `npm run test:run` | Vitest once |
| `npm run kb:update` | Rebuild KB from local JSON |
| `npm run kb:verify` | Verify normalized KB snapshot |

## API Surface (Active)

- `POST /api/call`
- `POST /api/translate`
- `GET /api/schemes/categories`
- `GET /api/schemes`
- `GET /api/schemes/category/:categoryId`
- `GET /api/schemes/search?q=`
- `GET /api/schemes/:schemeId`
- `POST /api/schemes/:schemeId/check-eligibility`
- `POST /api/knowledge-base/update`
- `GET /api/knowledge-base/status`
- `GET /api/knowledge-base/stats`
- `GET /api/knowledge-base/data`
- `GET /api/departments` (compat alias)
- `GET /health`
- Webhooks: `/plivo/answer`, `/plivo/status`, `/plivo/sms-status`
- WS: `/media`, `/ui-sync`, `/ws/google.ai.generativelanguage.*.GenerativeService.BidiGenerateContent`

## Known Limitations

- Runtime call context/logs are in-memory.
- API/auth/rate limiting is not yet hardened for open internet traffic.
- Some historical migration docs still exist for reference.

## Documentation

- `docs/TECHNICAL_DOCUMENTATION.md`
- `docs/PROJECT_FLOW.md`
- `docs/PROMPTS_REFERENCE.md`
- `docs/API_DOCUMENTATION.md`
- `docs/PROJECT_DOCUMENTATION.md`

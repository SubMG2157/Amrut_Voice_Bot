# Project Flow — अमृत सरकारी योजना पोर्टल Voice Bot

## 1) Web Demo Flow (Primary UI)

1. User clicks **Start Web Demo** in `App.tsx`.
2. `LiveClient` initializes mic/audio contexts.
3. Frontend fetches `GET /api/schemes` for runtime scheme set.
4. Client opens Gemini Live session through backend WS proxy.
5. Client sends greeting trigger (agent speaks first in Marathi).
6. User speech is streamed; sanitizer + retrieval injects top scheme context.
7. Agent response audio + transcript are shown in Live Trail.

## 2) Phone Flow (Plivo)

1. `POST /api/call` starts outbound call.
2. Plivo hits `/plivo/answer` and opens `WS /media`.
3. Backend bridge (`mediaStream.ts`) streams Plivo audio <-> Gemini Live.
4. `/ui-sync` pushes events to UI:
   - `CALL_STATUS`
   - `CUSTOMER_TURN`
   - `AGENT_TURN`
   - `AGENT_SPEAKING`

## 3) Knowledge Flow

1. Source of truth: `scheme_description.json`
2. Loader/parsing: `backend/knowledge/schemeCatalog.ts`
3. Optional normalization snapshots:
   - `backend/knowledge-store/raw-latest.json`
   - `backend/knowledge-store/normalized-latest.json`
4. Refresh endpoint: `POST /api/knowledge-base/update`

## 4) Latency + Robustness Controls

- Fast VAD tuning in live client.
- Noise/echo suppression before sending mic audio.
- Barge-in handling to cut stale agent playback.
- Query-time top-match context injection.
- Duplicate greeting suppression.

## 5) Current Runtime Characteristics

- Marathi-first by default.
- In-memory call/runtime state.
- Web demo is the main interaction UI.
- Phone mode remains available through Plivo APIs.

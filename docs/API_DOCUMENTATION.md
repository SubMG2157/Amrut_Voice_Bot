# API Documentation — अमृत सरकारी योजना पोर्टल Voice Bot

Backend entrypoint: `backend/server.ts`  
Default port: `3001` (`PORT` or `BACKEND_PORT` override).

## REST APIs

### POST `/api/call`
Starts outbound Plivo call.

Request:
```json
{
  "phone": "+919876543210",
  "name": "मयूर पाटील",
  "category": "general",
  "language": "Marathi",
  "agentGender": "female"
}
```

Response:
```json
{
  "callId": "uuid",
  "status": "initiated",
  "message": "Call initiated via Plivo"
}
```

### POST `/api/translate`
Translation helper for UI/testing.

Request:
```json
{ "text": "नमस्कार", "target": "en" }
```

Response:
```json
{ "text": "Hello" }
```

### GET `/api/schemes/categories`
Returns scheme categories.

### GET `/api/schemes`
Returns all schemes loaded from `scheme_description.json`.

### GET `/api/schemes/category/:categoryId`
Returns schemes in a category.

### GET `/api/schemes/search?q=...`
Keyword search over scheme data.

### GET `/api/schemes/:schemeId`
Returns one scheme by ID.

### POST `/api/schemes/:schemeId/check-eligibility`
Checks profile against parsed eligibility rules.

Example body:
```json
{
  "age": 24,
  "income": 30000,
  "location": "Pune"
}
```

### GET `/api/departments`
Compatibility alias for category list.

### Knowledge Base APIs
- `POST /api/knowledge-base/update`
- `GET /api/knowledge-base/status`
- `GET /api/knowledge-base/stats`
- `GET /api/knowledge-base/data`

### Health
- `GET /health` -> `{ "ok": true }`

## Webhooks

- `POST /plivo/answer` -> returns Plivo XML with stream URL.
- `POST /plivo/status` -> call status updates.
- `POST /plivo/sms-status` -> SMS delivery callbacks.

Compatibility aliases:
- `POST /twilio/voice` -> `/plivo/answer`
- `POST /twilio/status` -> `/plivo/status`

## WebSocket Endpoints

- `WS /media`  
  Plivo audio stream bridge to Gemini Live.

- `WS /ui-sync`  
  UI sync channel for call status/transcript updates.

- `WS /ws/google.ai.generativelanguage.<version>.GenerativeService.BidiGenerateContent`  
  Browser-to-Gemini proxy endpoint (backend attaches API key).

## Notes

- API routes are currently unauthenticated.
- Runtime call context is in-memory.
- For phone mode, `BACKEND_BASE_URL` must be publicly reachable.

# Medical Bot -> Government Scheme Bot Migration Plan

This plan is tailored to the current codebase (`App.tsx` at project root, `backend/server.ts`, `services/conversationEngine/*`, `backend/twilio/*`).

## 1) Target Product Definition

- Convert from **hospital appointment bot** to **government schemes assistant**.
- Default language must be **Marathi**.
- Support **Hindi** and **English** only when user switches.
- Bot should answer:
  - scheme details
  - eligibility criteria
  - required documents
  - application process
  - organization/portal info (e.g., अमृत सरकारी योजना पोर्टल)
- Add knowledge ingestion pipeline:
  - website scraping
  - normalized JSON store
  - refresh/update API
  - dashboard update button

## 2) Critical Guardrails (Do First)

1. **Never hardcode credentials** in code or docs.
   - Use env vars only:
     - `SCRAPER_AUTH_PHONE`
     - `SCRAPER_AUTH_PASSWORD`
2. Remove domain-unsafe content from prompts:
   - no medical diagnosis
   - no guarantees of benefit approval
3. Keep PII minimal:
   - do not ask for Aadhaar/bank details in voice flow.
4. Keep current architecture:
   - React + Express + ws + Gemini + Plivo.

## 3) Domain Model Migration

### Replace medical catalog with scheme catalog

- Create: `backend/knowledge/schemeCatalog.ts`
- Keep old `departmentCatalog.ts` temporarily for compatibility; remove after full migration.

Recommended types:

- `SchemeCategory`
- `Scheme`
- `EligibilityCriteria`
- `OrganizationInfo`
- `PortalProduct` (if needed)

Required helpers:

- `getAllSchemes()`
- `getSchemesByCategory(categoryId)`
- `findSchemeById(schemeId)`
- `findSchemeByQuery(text)` (keyword/fuzzy)
- `evaluateEligibility(scheme, profile)`

## 4) Conversation Engine Migration

### Files to change

- `services/conversationEngine/prompts.ts`
- `services/conversationEngine/index.ts`
- `services/endGreetings.ts`
- `backend/services/conversationEndDetector.ts` (closing phrases)

### Prompt behavior changes

1. Identity:
   - assistant for government scheme portal (not hospital).
2. Language policy:
   - Start in Marathi always.
   - Switch to Hindi/English only when user indicates.
   - Continue in switched language until user switches again.
3. Intent flow:
   - greeting -> discover scheme query -> answer -> optional eligibility check -> next query.
4. Restrict output:
   - use knowledge base only.
   - if unknown: point to official source.

### Remove/disable appointment-specific logic

- Slot extraction, doctor mapping, appointment confirmation phrases.
- Medical emergency text and clinic-specific content.

## 5) Backend API Migration

### Keep existing stable routes

- Keep `POST /api/call`
- Keep `POST /api/translate` (adapt language handling)
- Keep websocket routes `/media`, `/ui-sync`

### Add scheme APIs

- `GET /api/schemes/categories`
- `GET /api/schemes`
- `GET /api/schemes/:id`
- `POST /api/schemes/check-eligibility`
- `GET /api/schemes/search?q=...`

### Optional SMS info route

- `POST /api/schemes/send-info` (summary SMS only)

### What to deprecate

- `GET /api/slots/:department`
- `POST /api/appointment`
- `GET /api/appointments`
- `POST /api/reminder/trigger`

Do not delete immediately; mark deprecated first, then remove in phase 2.

## 6) Telephony and Runtime Context Changes

### File updates

- `backend/twilio/callContext.ts`
- `backend/twilio/callStarter.ts`
- `backend/twilio/mediaStream.ts`
- `backend/engineBridge.ts`

### Context fields

Replace appointment fields with:

- `userName`
- `preferredLanguage`
- `schemeCategory`
- `lastSchemeId`
- `eligibilityProfile` (partial)

### Phone format

- Move to India default.
- In `callStarter.ts`, normalize to `+91` if local 10-digit input.
- Validate robustly but not over-restrictive:
  - allow `+91XXXXXXXXXX`
  - allow local 10-digit then normalize.

## 7) Translation/Language Utilities

### Update these files

- `backend/services/translationService.ts`
- `services/languageDetection.ts` (or replace with Marathi/Hindi/English detector)

### Requirements

- Detect: Marathi/Hindi/English.
- Translate among these 3.
- Cache translations by key.
- Keep fast timeout/fallback behavior to avoid call lag.

## 8) Frontend Migration

### Main file

- `App.tsx` (project root; not `src/App.tsx` in this repo)

### UI changes

- Rename labels (patient -> user/citizen).
- Replace department dropdown with scheme category dropdown.
- Default language state to Marathi.
- Update placeholders and status text to government scheme context.
- Keep transcript, visualizer, logs, export features.

## 9) Knowledge Base Scraping + JSON Store

### Add new folder structure

- `backend/knowledge-store/raw/`
- `backend/knowledge-store/normalized/`
- `backend/scrapers/`
- `backend/services/knowledgeBase/`
- `backend/api/knowledgeBaseRoutes.ts`

### Suggested files

- `backend/scrapers/publicPortalScraper.ts`
- `backend/scrapers/authPortalScraper.ts`
- `backend/services/knowledgeBase/normalizer.ts`
- `backend/services/knowledgeBase/indexer.ts`
- `backend/services/knowledgeBase/store.ts`
- `backend/tests/knowledgeBase.verify.ts`

### JSON contracts

Raw scrape:

- metadata, url, html/text snapshot, extracted blocks

Normalized knowledge:

- `schemes[]`
- `organizations[]`
- `products[]`
- `updatedAt`
- `sourceVersion`

### Update endpoints

- `POST /api/knowledge-base/scrape`
- `GET /api/knowledge-base/scrape/status/:jobId`
- `GET /api/knowledge-base/stats`
- `POST /api/knowledge-base/reload`
- `GET /api/knowledge-base/files`

### Dashboard integration

- Add component `components/KnowledgeBaseManager.tsx`
- Floating button:
  - trigger scrape
  - poll status
  - show stats
  - reload KB

## 10) Scripts and Package Updates

In root `package.json` scripts add:

- `kb:scrape`
- `kb:verify`
- `kb:reload`
- `kb:stats`

If scraper uses Puppeteer, add dependency:

- `puppeteer`
- (optional) `cheerio` for HTML parsing

## 11) Testing Plan

### Unit

- scheme lookup
- eligibility evaluation
- language switching policy
- prompt generation policy (Marathi default)

### Integration

- `/api/schemes/*` responses
- `/api/call` sets new context shape
- `/ui-sync` still streams turns/status

### E2E smoke

1. start backend
2. start frontend
3. trigger call
4. confirm first greeting in Marathi
5. ask in Hindi -> verify switch
6. ask in English -> verify switch

## 12) Phase-wise Execution (Recommended)

### Phase 1 (safe, no breaking)

- Add new scheme catalog + scheme APIs.
- Add Marathi-first prompts.
- Keep old medical APIs temporarily.

### Phase 2 (switch runtime)

- Change `POST /api/call` context and conversation engine to schemes.
- Update frontend labels/fields.
- Update media stream greeting.

### Phase 3 (knowledge system)

- Add scrapers, JSON store, KB routes, dashboard KB manager.

### Phase 4 (cleanup)

- Remove deprecated appointment routes/modules.
- Remove medical docs and old terminology.

## 13) Known Pitfalls in Existing Draft Files

The current draft files under `files/` have issues you should avoid:

- Hardcoded login credentials in TypeScript files (security risk).
- Some path assumptions do not match this repo (`src/App.tsx` vs `App.tsx`).
- A few imports are incorrect for this codebase layout.
- Some suggested endpoint removals are too early and can break runtime.

Use this migration plan as the source of truth.

## 14) Cursor Prompt You Can Paste

Use this exact prompt with Cursor:

```text
Migrate this repository from KIMS medical appointment bot to a Marathi-first Government Scheme assistant, following MIGRATION_PLAN_GOV_SCHEME.md exactly.

Rules:
1) Keep current architecture (React + Express + ws + Gemini + Plivo).
2) Default language must be Marathi; switch to Hindi/English only when user switches.
3) Do not hardcode any credentials; use environment variables.
4) Implement in phases:
   - Phase 1: scheme domain model + APIs
   - Phase 2: conversation engine + runtime context + UI labels
   - Phase 3: knowledge scraping + JSON store + update APIs + dashboard manager
   - Phase 4: deprecate/remove old medical appointment routes
5) Update docs and tests after each phase.

Start by implementing Phase 1 and show a diff summary.
```


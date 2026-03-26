# Project Analysis — अमृत सरकारी योजना पोर्टल Voice Bot

## Current State Summary

- Domain migration from hospital appointment bot to government schemes is complete in active runtime paths.
- Primary knowledge source is local `scheme_description.json`.
- UI is web-demo focused with live transcript and AI voice interaction.
- Plivo phone bridge remains available for outbound calls.

## Strengths

- Marathi-first behavior with multilingual switching.
- Stronger retrieval for noisy/split Devanagari input.
- Per-query context injection improves relevance.
- Fast iteration cycle (Vite + tsx + Vitest).

## Risks / Gaps

- Runtime state persistence is in-memory only.
- No auth/rate limiting on APIs.
- Long-tail ASR edge cases can still affect precision.
- Legacy migration notes remain in `files/` directory and can confuse onboarding unless separated clearly.

## Recommended Next Improvements

1. Add persistent storage for call/session analytics.
2. Add API auth + rate limiting for public deployments.
3. Add deterministic fallback resolver for exact scheme-name + contact/date queries.
4. Add integration tests for:
   - split Devanagari name matching
   - duplicate greeting prevention
   - contact/date field response accuracy

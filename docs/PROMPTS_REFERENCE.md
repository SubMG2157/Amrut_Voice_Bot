# Prompts Reference — अमृत सरकारी योजना पोर्टल

## Source Files

- `services/conversationEngine/index.ts`
- `services/conversationEngine/prompts.ts`
- `services/conversationEngine/retrieval.ts`
- `services/endGreetings.ts`

## Active Prompt Model

The app uses a single active purpose:
- `scheme_information`

Core builder path:
1. `getSystemInstruction(...)`
2. `getBookingSystemInstruction(...)`
3. `buildSchemePrompt(...)`

## Persona and Language

- Agent names: `Priya` / `Rajesh`
- Portal name: `अमृत सरकारी योजना पोर्टल`
- Default language: Marathi
- Switch to Hindi/English only when user clearly requests

## Prompt Rules (Current)

- Speak first with Marathi greeting as soon as call connects.
- Focus only on government scheme information.
- If scheme name is already present in context, do not ask “which scheme?” again.
- If ASR text is noisy but closest scheme is clear, use closest match.
- Keep answers concise; ask one follow-up question at a time.
- For long user queries: short acknowledgement first, then answer.
- If context contains `phone/start_date/end_date/docs`, return those values directly.

## Retrieval + Context Injection

- Static prompt seed is available in `schemePromptSeed.ts` (fallback only).
- Primary runtime data comes from backend `schemeCatalog` via `/api/schemes`.
- Retrieval picks top matching schemes and injects compact context.
- Live client injects per-turn context for current user query.

## Closing

- Closing phrase set is managed by `services/endGreetings.ts`.
- Closing keywords are also used for call-end detection logic.

## Known Caveats

- Very noisy ASR can still create ambiguous inputs.
- Runtime context is optimized for speed; not all scheme fields are always surfaced unless relevant to current query.

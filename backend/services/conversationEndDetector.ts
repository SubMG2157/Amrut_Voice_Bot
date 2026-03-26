/**
 * Detect when the agent has said a final closing line so we can auto-hangup.
 */

import { getAllEndGreetingPhrases } from '../../services/endGreetings.js';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Patterns that must match at END of turn. */
const CLOSING_PHRASES_END: RegExp[] = [
  ...getAllEndGreetingPhrases().map((p) => {
    const escaped = escapeRegex(p).replace(/\\.$/, '\\.?');
    return new RegExp(escaped + '\\s*$', 'i');
  }),
  /धन्यवाद[.!।]?\s*$/i,
  /शुभ\s+दिवस[.!।]?\s*$/i,
  /thank you\.?\s*$/i,
  /thanks\.?\s*$/i,
  /आपका\s+दिन\s+शुभ\s+हो[.!।]?\s*$/i,
];

/** Patterns that may appear anywhere (explicit disconnect intent). */
const CLOSING_PHRASES_ANYWHERE: RegExp[] = [
  /कॉल\s+समाप्त/i,
  /मैं\s+कॉल\s+बंद/i,
  /मला\s+कॉल\s+बंद/i,
  /disconnect (now|the call)/i,
];

/** Returns true only when the agent's turn is a closing line (end of conversation). */
export function isAgentClosingLine(text: string): boolean {
  const normalized = String(text || '').trim();
  if (!normalized) return false;
  if (CLOSING_PHRASES_ANYWHERE.some((rx) => rx.test(normalized))) return true;
  return CLOSING_PHRASES_END.some((rx) => rx.test(normalized));
}

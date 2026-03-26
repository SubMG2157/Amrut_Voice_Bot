import type { Language, AgentGender as AppAgentGender } from '../../types.ts';
import {
  buildSchemePrompt,
  getAgentName,
  CLOSING_PHRASE_MR,
  type AgentGender,
  type CallType,
} from './prompts.ts';
import { PROMPT_SCHEME_SEED } from './schemePromptSeed.ts';
import { retrieveTopSchemes } from './retrieval.ts';
import type { Scheme } from '../../backend/knowledge/schemeCatalog.ts';

export const VOICE_MAP: Record<AgentGender, string> = {
  female: 'Aoede',
  male: 'Puck',
};

export function getBookingSystemInstruction(
  agentGender: AgentGender,
  userName: string,
  categoryHint?: string,
  availableSchemes?: Scheme[],
): string {
  const source = availableSchemes && availableSchemes.length > 0 ? availableSchemes : PROMPT_SCHEME_SEED;
  const normalizedCategoryHint =
    categoryHint && categoryHint.trim().toLowerCase() !== 'general' ? categoryHint : undefined;
  const topSchemes = retrieveTopSchemes(source, {
    categoryHint: normalizedCategoryHint,
    query: normalizedCategoryHint,
    // Web demo starts with "general"; keep a broader shortlist so uncommon scheme names are covered.
    limit: normalizedCategoryHint ? 18 : 120,
  });
  return buildSchemePrompt(agentGender, userName, topSchemes);
}

// Backward-compatible entrypoint used by backend/engineBridge.ts.
// Keeps existing signature while routing to the richer booking prompt flow.
export function getSystemInstruction(
  _language: Language,
  userName?: string,
  categoryHint?: string,
  agentGender?: AppAgentGender,
  availableSchemes?: Scheme[],
): string {
  return getBookingSystemInstruction(
    (agentGender ?? 'female') as AgentGender,
    userName?.trim() || 'नागरिक',
    categoryHint,
    availableSchemes,
  );
}

// Sent as a user-role trigger to Gemini immediately after session opens.
// Kept in English because this instruction is for the model, not the patient.
export function getGreetingTrigger(callType: CallType, userName: string): string {
  const suffix = userName ? ` for user ${userName}` : '';
  if (callType === 'scheme_information') {
    return `The call is now connected${suffix}. Start the scheme-assistance greeting immediately in Marathi.`;
  }
  return `The call is now connected${suffix}. Start the scheme-assistance greeting immediately in Marathi.`;
}

export const CLOSING_KEYWORDS = [
  'धन्यवाद',
  'शुभ दिवस',
  'धन्यवाद।',
  'thank you for using',
  'goodbye',
  'have a good day',
];

export function isClosingTurn(text: string): boolean {
  const lower = text.toLowerCase();
  return CLOSING_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

export const SMS_TRIGGER_PHRASES = [
  'मी तुम्हाला संदेश पाठवतो',
  'मी तुम्हाला मेसेज पाठवते',
  'योजनेची माहिती संदेशाने पाठवतो',
  'योजनेची माहिती संदेशाने पाठवते',
  'send you scheme details',
  'send you a message',
  'scheme details by sms',
];

export function isSmsLine(text: string): boolean {
  const lower = text.toLowerCase();
  return SMS_TRIGGER_PHRASES.some((phrase) => lower.includes(phrase.toLowerCase()));
}

// Compatibility alias for legacy symbol usage.
export const isSMSTriggerTurn = isSmsLine;

export function extractConfirmedSlot(agentText: string): { time?: string; date?: string } {
  const result: { time?: string; date?: string } = {};
  const enTime = agentText.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (enTime) {
    let h = parseInt(enTime[1], 10);
    const m = enTime[2] ?? '00';
    if (enTime[3].toUpperCase() === 'PM' && h < 12) h += 12;
    if (enTime[3].toUpperCase() === 'AM' && h === 12) h = 0;
    result.time = `${String(h).padStart(2, '0')}:${m}`;
  }
  if (agentText.includes('उद्या') || /tomorrow/i.test(agentText)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    result.date = d.toISOString().slice(0, 10);
  } else if (agentText.includes('आज') || /today/i.test(agentText)) {
    result.date = new Date().toISOString().slice(0, 10);
  }
  return result;
}

export function extractReminderAction(
  agentText: string,
): 'confirmed' | 'cancelled' | 'reschedule' | null {
  const lower = agentText.toLowerCase();

  if (
    agentText.includes('रद्द') ||
    lower.includes('cancelled')
  ) {
    return 'cancelled';
  }

  if (
    agentText.includes('बदल') ||
    lower.includes('rescheduled')
  ) {
    return 'reschedule';
  }

  if (
    agentText.includes('पुष्टी') ||
    lower.includes('confirmed')
  ) {
    return 'confirmed';
  }

  return null;
}

export {
  buildSchemePrompt,
  getAgentName,
  CLOSING_PHRASE_MR,
};

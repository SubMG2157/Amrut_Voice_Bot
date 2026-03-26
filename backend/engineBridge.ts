/**
 * Bridge: Plivo call ↔ Conversation Engine (same prompts as web).
 * getSystemInstruction from services/conversationEngine — no duplicate logic.
 * Per-call Gemini Live session.
 */

import { getSystemInstruction } from '../services/conversationEngine/index.js';
import { getAllSchemes } from './knowledge/schemeCatalog.js';
import type { Language, AgentGender } from '../types.js';
import type { CallContext } from './twilio/callStarter.js';

export interface CallSessionContext extends CallContext {
  callSid: string;
}

export function buildSystemInstructionContext(context: CallSessionContext): string {
  const schemes = getAllSchemes();
  return getSystemInstruction(
    context.language as Language,
    context.userName,
    context.schemeCategory,
    (context.agentGender ?? 'female') as AgentGender,
    schemes,
  );
}

export function getEngineContext(callSid: string, context: CallContext): CallSessionContext {
  return {
    callSid,
    userName: context.userName ?? 'नागरिक',
    schemeCategory: context.schemeCategory ?? 'general',
    language: context.language ?? 'Marathi',
    agentGender: context.agentGender ?? 'female',
    purpose: 'scheme_information',
  };
}

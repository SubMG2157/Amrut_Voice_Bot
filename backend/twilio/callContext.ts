/**
 * In-memory store: callSid → context (user, scheme category, language, phone).
 * Used when Plivo Media Stream connects so we have context for Gemini.
 */

import type { CallContext } from './callStarter.js';

export interface StoredCallContext extends CallContext {
  phone?: string;
  schemeId?: string;
}

const store = new Map<string, StoredCallContext>();

export function setCallContext(callSid: string, context: StoredCallContext) {
  store.set(callSid, context);
}

export function getCallContext(callSid: string): StoredCallContext | undefined {
  return store.get(callSid);
}

export function updateCallContext(callSid: string, partial: Partial<StoredCallContext>) {
  const ctx = store.get(callSid);
  if (ctx) {
    Object.assign(ctx, partial);
    console.log(`[CallContext] Updated ${callSid}:`, partial);
  }
}

export function deleteCallContext(callSid: string) {
  store.delete(callSid);
}

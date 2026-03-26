/**
 * Transcript sanitizer for Marathi/Hindi/English speech text.
 */

const NOISE_REGEX = /^(hmm+|uh+|ah+|um+|hm+|…+|\.+|-+)$/i;

// Allowed: Basic Latin + Devanagari + Arabic (kept for backward compatibility).
const ALLOWED_REGEX = /[^\u0000-\u007F\u0900-\u097F\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF0-9.,?!;:'"()\-–—…\s]/g;

type DetectedLang = 'en' | 'mr_hi' | 'ar' | 'unknown';

export interface SanitizeOptions {
  preferArabic?: boolean; // legacy option name; treated as "prefer Indic script"
  preferDevanagari?: boolean;
  dropIsolatedLatinWords?: boolean;
  dropUnclear?: boolean;
  applyTelephonyCorrections?: boolean;
}

function detectLangConfidence(text: string): { lang: DetectedLang; confidence: number } {
  let en = 0;
  let ar = 0;
  let dev = 0;
  let total = 0;

  for (const ch of text) {
    if (ch.trim() === '') continue; // ignore whitespace
    const code = ch.codePointAt(0)!;

    // Latin letters A-Z, a-z
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      en++;
      total++;
    }
    // Arabic letters
    else if ((code >= 0x0600 && code <= 0x06FF) || (code >= 0x0750 && code <= 0x077F) || (code >= 0xFB50 && code <= 0xFDFF) || (code >= 0xFE70 && code <= 0xFEFF)) {
      ar++;
      total++;
    }
    // Devanagari letters
    else if (code >= 0x0900 && code <= 0x097F) {
      dev++;
      total++;
    }
    // Note: Numbers and punctuation do NOT contribute to `total`, meaning they don't dilute the confidence!
  }

  if (total === 0) return { lang: 'unknown', confidence: 0 };

  const max = Math.max(en, ar, dev);
  if (max === en) return { lang: 'en', confidence: en / total };
  if (max === dev) return { lang: 'mr_hi', confidence: dev / total };
  return { lang: 'ar', confidence: ar / total };
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function repairDevanagariSpacing(text: string): string {
  let out = text;
  // Remove spaces before dependent signs (matra/halant/nasal marks).
  out = out.replace(/\s+([\u093E-\u094D\u0901-\u0903])/g, '$1');
  // Remove spaces after halant to keep conjuncts together.
  out = out.replace(/\u094D\s+/g, '\u094D');
  return out;
}

function shouldDropIsolatedLatin(text: string): boolean {
  const normalized = normalizeWhitespace(text);
  const hasTargetScript = /[\u0900-\u097F]/.test(normalized);
  if (hasTargetScript) return false;
  return /^[A-Za-z]{2,12}[.]?$/.test(normalized);
}

function applyTelephonyCorrections(text: string): string {
  let result = text;

  // Fix a few common telephony STT artifacts.
  result = result.replace(/\byojana\b/gi, 'योजना');
  result = result.replace(/\bmahaamrut\b/gi, 'महाअमृत');
  result = result.replace(/\bmarina\b\.?/gi, 'नाही');
  result = result.replace(/ce\s+n['’]?a\s+eu\s+pe\s+cameron/gi, 'छान आहे');
  result = result.replace(/\bpe\s+cameron\b/gi, 'छान');
  result = result.replace(/\boui\b/gi, 'हो');
  result = result.replace(/\bnon\b/gi, 'नाही');

  const normalized = normalizeWhitespace(result).replace(/[.?!]+$/g, '');
  if (!normalized) return result;

  if (/^nahi+$/i.test(normalized) || /^nahee$/i.test(normalized) || /^no$/i.test(normalized)) return 'नाही';
  if (/^ok(?:ay)?$/i.test(normalized)) return 'ठीक आहे';
  if (/^yes$/i.test(normalized) || /^yeah?$/i.test(normalized)) return 'हो';
  if (/^hello$/i.test(normalized) || /^helo$/i.test(normalized)) return 'नमस्कार';
  if (/^bye$/i.test(normalized) || /^goodbye$/i.test(normalized)) return 'धन्यवाद';
  
  return result;
}

export interface SanitizeResult {
  output: string | null;
  isUnclear: boolean;
}

export function sanitizeTranscript(text: string, options: SanitizeOptions = {}): SanitizeResult {
  if (!text) return { output: null, isUnclear: false };

  const correctedInput = options.applyTelephonyCorrections ? applyTelephonyCorrections(text) : text;
  const preferDevanagari = options.preferDevanagari ?? options.preferArabic ?? false;
  const cleaned = repairDevanagariSpacing(correctedInput.replace(ALLOWED_REGEX, ''));

  if (cleaned.length === 0) return { output: null, isUnclear: false };
  if (NOISE_REGEX.test(cleaned)) return { output: null, isUnclear: false };
  if (cleaned.length < 1) return { output: null, isUnclear: false };

  if (preferDevanagari) {
    const hasTargetScript = /[\u0900-\u097F]/.test(cleaned);
    if (!hasTargetScript) {
      return { output: null, isUnclear: false };
    }
  }

  if (options.dropIsolatedLatinWords && shouldDropIsolatedLatin(cleaned)) {
    return { output: null, isUnclear: false };
  }

  const { confidence } = detectLangConfidence(cleaned);
  const threshold = options.preferArabic ? 0.45 : 0.5;
  
  if (confidence >= threshold) {
    return { output: cleaned, isUnclear: false };
  }

  if (options.dropUnclear) {
    return { output: null, isUnclear: true };
  }

  if (cleaned.length <= 1) {
    return { output: null, isUnclear: true };
  }

  if (cleaned.length >= 2) {
    return { output: '[unclear]', isUnclear: true };
  }

  return { output: null, isUnclear: false };
}

export function isCleanTranscript(text: string): boolean {
  const { output } = sanitizeTranscript(text);
  return output !== null;
}

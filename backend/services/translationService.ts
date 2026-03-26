/**
 * Translation service for Marathi/Hindi/English captions and UI helpers.
 */

const GEMINI_TEXT_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const MAX_CACHE = 500;
const cacheMr = new Map<string, string>();
const cacheHi = new Map<string, string>();
const cacheEn = new Map<string, string>();

async function callGeminiText(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    console.warn('[TranslationService] No GEMINI_API_KEY');
    return '';
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${GEMINI_TEXT_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 300 },
      }),
    });
    clearTimeout(timer);

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown error');
      console.warn('[TranslationService] API error:', err.slice(0, 200));
      return '';
    }

    const data = await res.json() as any;
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  } catch (err) {
    console.error('[TranslationService] Exception:', (err as Error).message);
    return '';
  }
}

function cacheSet(map: Map<string, string>, key: string, value: string): void {
  if (map.size >= MAX_CACHE) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, value);
}

function isMostlyDevanagari(text: string): boolean {
  if (!text) return false;
  const devanagariChars = (text.match(/[\u0900-\u097F]/g) || []).length;
  return devanagariChars / text.length > 0.3;
}

export async function translateToMarathi(rawText: string): Promise<string> {
  if (!rawText?.trim()) return '';
  const norm = rawText.trim();
  if (isMostlyDevanagari(norm)) return norm;

  const cached = cacheMr.get(norm);
  if (cached !== undefined) return cached;

  const translated = await callGeminiText(
    `Translate the following text to natural Marathi (Devanagari script). Return ONLY the Marathi translation, no explanation, no quotes.\n\nText: ${norm}`
  );

  const value = translated || norm;
  cacheSet(cacheMr, norm, value);
  return value;
}

export async function translateToHindi(rawText: string): Promise<string> {
  if (!rawText?.trim()) return '';
  const norm = rawText.trim();
  const cached = cacheHi.get(norm);
  if (cached !== undefined) return cached;
  const translated = await callGeminiText(
    `Translate the following text to natural Hindi (Devanagari script). Return ONLY the Hindi translation, no explanation, no quotes.\n\nText: ${norm}`
  );
  const value = translated || norm;
  cacheSet(cacheHi, norm, value);
  return value;
}

export async function translateToEnglish(text: string): Promise<string> {
  if (!text?.trim()) return '';
  const norm = text.trim();
  const cached = cacheEn.get(norm);
  if (cached !== undefined) return cached;

  const translated = await callGeminiText(
    `Translate the following text to natural English. Return ONLY the English translation, no explanation, no quotes.\n\nText: ${norm}`
  );

  const value = translated || norm;
  cacheSet(cacheEn, norm, value);
  return value;
}

// Backward-compatible alias retained for existing imports.
export async function translateToArabic(rawText: string): Promise<string> {
  return translateToMarathi(rawText);
}

export async function translatePatientTurn(
  rawText: string,
): Promise<{ arabicText: string; englishCaption: string }> {
  if (!rawText?.trim()) return { arabicText: '', englishCaption: '' };
  const marathiText = await translateToMarathi(rawText);
  const englishCaption = await translateToEnglish(marathiText);
  return { arabicText: marathiText, englishCaption };
}

export async function translateAgentTurn(
  text: string,
): Promise<{ arabicText: string; englishCaption: string }> {
  if (!text?.trim()) return { arabicText: '', englishCaption: '' };
  const englishCaption = await translateToEnglish(text);
  return { arabicText: text, englishCaption };
}

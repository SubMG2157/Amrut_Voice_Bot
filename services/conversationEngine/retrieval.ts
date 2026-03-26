import type { Scheme } from '../../backend/knowledge/schemeCatalog.ts';

export interface RetrieveOptions {
  query?: string;
  categoryHint?: string;
  limit?: number;
}

function normalize(text: string): string {
  let out = text.toLowerCase();
  // Merge artificially split Devanagari fragments: "अ मृ त अ लं कार" -> "अमृत अलंकार"
  out = out.replace(/([\u0900-\u097F])\s+(?=[\u0900-\u097F])/g, '$1');
  return out.replace(/\s+/g, ' ').trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function compact(text: string): string {
  return normalize(text).replace(/[^\p{L}\p{N}]+/gu, '');
}

function scoreScheme(
  scheme: Scheme,
  tokens: string[],
  queryNorm: string,
  queryCompact: string,
  categoryHint?: string,
): number {
  let score = 0;
  const category = (scheme.category || '').toLowerCase();
  if (categoryHint && category === categoryHint.toLowerCase()) score += 8;

  const name = normalize(`${scheme.nameMr} ${scheme.nameHi} ${scheme.nameEn}`);
  const nameCompact = compact(name);
  const desc = `${scheme.description} ${(scheme.benefits || []).join(' ')} ${(scheme.documentsRequired || []).join(' ')}`.toLowerCase();

  for (const token of tokens) {
    if (name.includes(token)) score += 4;
    else if (desc.includes(token)) score += 2;
    if (category.includes(token)) score += 2;
  }

  // Fuzzy exactness for split/merged ASR queries (e.g. "अ मृ त अ लं कार").
  if (queryCompact.length >= 6 && nameCompact.length >= 6) {
    if (nameCompact.includes(queryCompact)) score += 12;
    const prefix = nameCompact.slice(0, Math.min(nameCompact.length, 16));
    if (prefix.length >= 6 && queryCompact.includes(prefix)) score += 18;
    if (queryCompact.includes('अमृत') && nameCompact.includes('अमृत')) score += 3;
  }

  // Prefer entries with richer detail when scores tie.
  if ((scheme.benefits?.length || 0) > 0) score += 1;
  if ((scheme.documentsRequired?.length || 0) > 0) score += 1;

  if (scheme.id === 'amrut-organization') {
    const orgIntent =
      /संस्थ|प्रबोधनी|mahaamrut|कार्यालय|मुख्यालय|पत्ता|संपर्क|फोन|ईमेल|ई-मेल|email|contact|website|स्थापन|who\s+is|what\s+is|about\s+amrut|अमृत\s+(म्हणजे|बद्दल|काय|कोण)/i.test(
        queryNorm,
      ) ||
      (/अमृत|amrut/i.test(queryNorm) &&
        !/योजन|scheme|योजने|कागदपत्र|अर्ज\s*कस|पात्रता\s*तुमच/i.test(queryNorm));
    if (orgIntent) score += 28;
  }

  // AMRUT divisions/initiatives (not standalone schemes).
  const AMRUT_DIVISION_NAME_MR = [
    'अमृत पेठ',
    'अमृत विद्या',
    'अमृत महाराष्ट्र',
    'अमृत मानसमित्र',
    'अमृत ड्रोन मिशन',
    'अमृत पर्यटन',
    'अमृत उद्यम मिशन',
    'अमृत वर्ग',
    'अमृत पेठ थेट बाजारपेठ',
  ];
  const entryIsDivision = !!scheme.nameMr && AMRUT_DIVISION_NAME_MR.some((p) => scheme.nameMr.trim().startsWith(p));
  if (entryIsDivision) {
    const queryMentionsDivision = AMRUT_DIVISION_NAME_MR.some((p) => queryNorm.includes(normalize(p)));
    if (queryMentionsDivision) score += 30;
  }
  return score;
}

export function retrieveTopSchemes(
  schemes: Scheme[],
  options: RetrieveOptions = {},
): Scheme[] {
  const limit = Math.max(1, Math.min(200, options.limit ?? 5));
  if (!schemes.length) return [];

  const queryNorm = normalize(`${options.query || ''} ${options.categoryHint || ''}`);
  const queryCompact = compact(queryNorm);
  const tokens = tokenize(queryNorm);

  // If the user asks about AMRUT itself (organization info) and does not mention any
  // specific AMRUT division name, we should strongly prefer the synthetic
  // `amrut-organization` entry.
  const AMRUT_DIVISION_NAME_MR = [
    'अमृत पेठ',
    'अमृत विद्या',
    'अमृत महाराष्ट्र',
    'अमृत मानसमित्र',
    'अमृत ड्रोन मिशन',
    'अमृत पर्यटन',
    'अमृत उद्यम मिशन',
    'अमृत वर्ग',
    'अमृत पेठ थेट बाजारपेठ',
  ];
  const hasDivisionName = AMRUT_DIVISION_NAME_MR.some((p) => queryNorm.includes(normalize(p)));
  const orgIntent =
    /संस्था|प्रबोधनी|माहिती|संपर्क|कार्यालय|मुख्यालय|पत्ता|फोन|ईमेल|email|website|portal|बद्दल|about\s+amrut|what\s+is\s+amrut|who\s+is\s+amrut/i.test(
      queryNorm,
    ) && /अमृत|amrut/i.test(queryNorm);

  if (orgIntent && !hasDivisionName) {
    const org = schemes.find((s) => s.id === 'amrut-organization');
    if (org) return [org];
  }

  const scored = schemes
    .map((scheme) => ({
      scheme,
      score: scoreScheme(scheme, tokens, queryNorm, queryCompact, options.categoryHint),
    }))
    .sort((a, b) => b.score - a.score);

  // Strong boost for near-exact name inclusion after normalization.
  for (const item of scored) {
    const nameNorm = normalize(`${item.scheme.nameMr} ${item.scheme.nameHi} ${item.scheme.nameEn}`);
    if (queryNorm.length >= 4 && (nameNorm.includes(queryNorm) || queryNorm.includes(nameNorm.slice(0, Math.min(nameNorm.length, 20))))) {
      item.score += 18;
    }
  }

  const hasSignal = scored.some((s) => s.score > 0);
  if (!hasSignal) {
    // No keyword signal: fall back to category hint first, then stable head.
    const byCategory = options.categoryHint
      ? schemes.filter((s) => s.category === options.categoryHint)
      : [];
    const base = byCategory.length ? byCategory : schemes;
    return base.slice(0, limit);
  }

  return scored
    .filter((s) => s.score > 0)
    .slice(0, limit)
    .map((s) => s.scheme);
}


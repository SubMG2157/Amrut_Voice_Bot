/**
 * Runtime scheme catalog.
 * Primary source: root `scheme_description.json`.
 * Fallback: bundled static examples.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { tryLoadAmrutOrganizationScheme } from './amrutOrganizationLoad.js';

export interface EligibilityCriteria {
  age?: { min: number; max: number };
  income?: { max: number; currency: 'INR' };
  category?: string[];
  gender?: 'male' | 'female' | 'all';
  location?: string[];
}

export interface Scheme {
  id: string;
  category: string;
  nameMr: string;
  nameHi: string;
  nameEn: string;
  description: string;
  eligibility: EligibilityCriteria;
  benefits: string[];
  documentsRequired: string[];
  applicationProcess: string;
  officialWebsite?: string;
  helplineNumber?: string;
  schemeStartDate?: string;
  applicationDeadline?: string;
}

export interface SchemeCategory {
  id: string;
  nameMr: string;
  nameHi: string;
  nameEn: string;
  description: string;
  schemes: Scheme[];
}

export interface UserEligibilityProfile {
  age?: number;
  income?: number;
  category?: string;
  gender?: 'male' | 'female';
  location?: string;
}

interface RawSchemeRow {
  id?: number | string;
  name?: string | null;
  nameMr?: string | null;
  nameHi?: string | null;
  nameEn?: string | null;
  category?: string | null;
  description?: string | null;
  eligibility?: string | null;
  benefits?: string | null;
  documents?: string | null;
  documentsRequired?: string | null;
  process?: string | null;
  applicationProcess?: string | null;
  application_address?: string | null;
  officialWebsite?: string | null;
  helplineNumber?: string | null;
  mobile_no?: number | string | null;
  schemeStartDate?: number | string | null;
  applicationDeadline?: number | string | null;
  scheme_start_date?: number | string | null;
  application_deadline?: number | string | null;
}

const BASE_CATEGORIES: Omit<SchemeCategory, 'schemes'>[] = [
  { id: 'housing', nameMr: 'गृहनिर्माण योजना', nameHi: 'आवास योजना', nameEn: 'Housing Schemes', description: 'घरकुल आणि गृहनिर्माण योजना' },
  { id: 'women_empowerment', nameMr: 'महिला सबलीकरण', nameHi: 'महिला सशक्तिकरण', nameEn: 'Women Empowerment', description: 'महिला आणि बालकल्याण योजना' },
  { id: 'education', nameMr: 'शिक्षण योजना', nameHi: 'शिक्षा योजना', nameEn: 'Education Schemes', description: 'शिक्षण आणि कौशल्य विकास योजना' },
  { id: 'health', nameMr: 'आरोग्य योजना', nameHi: 'स्वास्थ्य योजना', nameEn: 'Health Schemes', description: 'आरोग्य आणि विमा योजना' },
  { id: 'agriculture', nameMr: 'शेती योजना', nameHi: 'कृषि योजना', nameEn: 'Agriculture Schemes', description: 'कृषी आणि शेतकरी योजना' },
  { id: 'general', nameMr: 'सर्वसाधारण योजना', nameHi: 'सामान्य योजनाएँ', nameEn: 'General Schemes', description: 'इतर सर्व योजना' },
];

const STATIC_FALLBACK: Scheme[] = [
  {
    id: 'pmay',
    category: 'housing',
    nameMr: 'प्रधानमंत्री आवास योजना',
    nameHi: 'प्रधानमंत्री आवास योजना',
    nameEn: 'Pradhan Mantri Awas Yojana',
    description: 'परवडणाऱ्या घरांसाठी कर्ज अनुदान योजना',
    eligibility: { income: { max: 1800000, currency: 'INR' }, gender: 'all' },
    benefits: ['घरकर्जावर व्याज अनुदान'],
    documentsRequired: ['आधार कार्ड', 'उत्पन्न प्रमाणपत्र'],
    applicationProcess: 'अधिकृत पोर्टलवर ऑनलाइन अर्ज करा.',
  },
  {
    id: 'ujjwala',
    category: 'women_empowerment',
    nameMr: 'प्रधानमंत्री उज्ज्वला योजना',
    nameHi: 'प्रधानमंत्री उज्ज्वला योजना',
    nameEn: 'Pradhan Mantri Ujjwala Yojana',
    description: 'महिलांसाठी LPG जोडणी सहाय्य',
    eligibility: { gender: 'female' },
    benefits: ['LPG जोडणी मदत'],
    documentsRequired: ['आधार कार्ड'],
    applicationProcess: 'जवळच्या वितरकाकडे अर्ज करा.',
  },
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SCHEME_FILE = path.join(ROOT, 'scheme_description.json');

let cachedSchemes: Scheme[] | null = null;
let cachedCategories: SchemeCategory[] | null = null;

function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/_x000D_/g, '')
    .replace(/[~]+/g, '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitField(text: string): string[] {
  return cleanText(text)
    .split(/\n|,|;|•/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function inferCategory(text: string): string {
  const t = text.toLowerCase();
  if (/house|housing|आवास|घरकुल|घर/.test(t)) return 'housing';
  if (/women|महिला|स्त्री|girl|child/.test(t)) return 'women_empowerment';
  if (/educat|शिक्षण|कौशल्य|training|skill|certificate/.test(t)) return 'education';
  if (/health|आरोग्य|स्वास्थ्य|medical|hospital|insurance/.test(t)) return 'health';
  if (/farmer|agri|कृषी|शेती|धान|पीक/.test(t)) return 'agriculture';
  return 'general';
}

function parseIncomeLimit(eligibilityText: string): EligibilityCriteria['income'] | undefined {
  const t = cleanText(eligibilityText);
  // Handles "8 लाख", "८ लाख", "₹8 lakh" patterns.
  const m = t.match(/(?:₹|रु|rs\.?)?\s*([0-9०-९]+)\s*(?:लाख|lakh)/i);
  if (!m) return undefined;
  const digitMap: Record<string, string> = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' };
  const num = Number(m[1].split('').map((c) => digitMap[c] ?? c).join(''));
  if (!Number.isFinite(num) || num <= 0) return undefined;
  return { max: num * 100000, currency: 'INR' };
}

function parseAgeRange(eligibilityText: string): EligibilityCriteria['age'] | undefined {
  const t = cleanText(eligibilityText);
  const m = t.match(/([0-9]{1,2})\s*(?:ते|-|to)\s*([0-9]{1,2})\s*(?:वर्ष|years?)/i);
  if (!m) return undefined;
  const min = Number(m[1]);
  const max = Number(m[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) return undefined;
  return { min, max };
}

function toHelpline(mobile: RawSchemeRow['mobile_no']): string | undefined {
  if (mobile == null) return undefined;
  const digits = String(mobile).replace(/\.0$/, '').replace(/\D/g, '');
  if (digits.length < 10) return undefined;
  return digits.slice(0, 10);
}

function extractWebsite(text: string): string | undefined {
  const hit = cleanText(text).match(/https?:\/\/[^\s)"]+/i)?.[0];
  return hit || undefined;
}

function toIsoDate(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) {
    const d = new Date(n);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = cleanText(value);
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

function rowToScheme(row: RawSchemeRow): Scheme | null {
  const idPart = String(row.id ?? '').trim();
  const name = cleanText(row.nameMr || row.nameEn || row.nameHi || row.name);
  if (!idPart || !name) return null;
  const description = cleanText(row.description);
  const eligibilityText = cleanText(row.eligibility);
  const category = cleanText(row.category) || inferCategory(`${name} ${description} ${eligibilityText}`);
  const applicationAddress = String(row.officialWebsite ?? row.application_address ?? '');

  return {
    id: `scheme-${idPart}`,
    category,
    nameMr: cleanText(row.nameMr) || name,
    nameHi: cleanText(row.nameHi) || cleanText(row.nameMr) || name,
    nameEn: cleanText(row.nameEn) || cleanText(row.nameMr) || name,
    description: description || name,
    eligibility: {
      income: parseIncomeLimit(eligibilityText),
      age: parseAgeRange(eligibilityText),
    },
    benefits: splitField(String(row.benefits ?? '')),
    documentsRequired: splitField(String(row.documentsRequired ?? row.documents ?? '')),
    applicationProcess: cleanText(row.applicationProcess ?? row.process),
    officialWebsite: extractWebsite(`${applicationAddress} ${String(row.applicationProcess ?? row.process ?? '')}`),
    helplineNumber: cleanText(row.helplineNumber) || toHelpline(row.mobile_no),
    schemeStartDate: toIsoDate(row.schemeStartDate ?? row.scheme_start_date),
    applicationDeadline: toIsoDate(row.applicationDeadline ?? row.application_deadline),
  };
}

function buildCategories(schemes: Scheme[]): SchemeCategory[] {
  return BASE_CATEGORIES.map((base) => ({
    ...base,
    schemes: schemes.filter((s) => s.category === base.id),
  }));
}

function loadRuntimeSchemes(): Scheme[] {
  try {
    const rawText = fs.readFileSync(SCHEME_FILE, 'utf-8');
    const parsed = JSON.parse(rawText) as unknown;
    const rows: RawSchemeRow[] = Array.isArray(parsed)
      ? (parsed as RawSchemeRow[])
      : (parsed as { schemes?: unknown })?.schemes && Array.isArray((parsed as { schemes?: unknown }).schemes)
      ? ((parsed as { schemes: RawSchemeRow[] }).schemes)
      : [];
    if (!rows.length) return STATIC_FALLBACK;
    const mapped = rows
      .map(rowToScheme)
      .filter((s): s is Scheme => !!s);
    const base = mapped.length ? mapped : STATIC_FALLBACK;
    const org = tryLoadAmrutOrganizationScheme();
    return org ? [...base, org as Scheme] : base;
  } catch {
    return STATIC_FALLBACK;
  }
}

function ensureLoaded() {
  if (cachedSchemes && cachedCategories) return;
  cachedSchemes = loadRuntimeSchemes();
  cachedCategories = buildCategories(cachedSchemes);
}

export function getSchemeCategories(): SchemeCategory[] {
  ensureLoaded();
  return cachedCategories!;
}

export const SCHEME_CATEGORIES: SchemeCategory[] = getSchemeCategories();

export function getAllSchemes(): Scheme[] {
  ensureLoaded();
  return cachedSchemes!;
}

export function getSchemesByCategory(categoryId: string): Scheme[] {
  const category = getSchemeCategories().find((c) => c.id === categoryId);
  return category?.schemes ?? [];
}

export function findSchemeById(schemeId: string): Scheme | undefined {
  return getAllSchemes().find((s) => s.id === schemeId || s.id === `scheme-${schemeId}`);
}

export function findSchemeByQuery(query: string): Scheme[] {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  return getAllSchemes().filter((s) =>
    [s.nameEn, s.nameMr, s.nameHi, s.description].some((v) => (v || '').toLowerCase().includes(q)),
  );
}

export function evaluateEligibility(
  scheme: Scheme,
  profile: UserEligibilityProfile,
): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const rule = scheme.eligibility;

  if (rule.age && profile.age != null) {
    if (profile.age < rule.age.min || profile.age > rule.age.max) {
      reasons.push(`वय ${rule.age.min} ते ${rule.age.max} दरम्यान असावे.`);
    }
  }

  if (rule.income && profile.income != null) {
    if (profile.income > rule.income.max) {
      reasons.push(`वार्षिक उत्पन्न ₹${rule.income.max} पेक्षा कमी असावे.`);
    }
  }

  if (rule.category && profile.category) {
    if (!rule.category.includes(profile.category)) {
      reasons.push(`फक्त ${rule.category.join(', ')} वर्गासाठी लागू.`);
    }
  }

  if (rule.gender && rule.gender !== 'all' && profile.gender) {
    if (rule.gender !== profile.gender) {
      reasons.push(rule.gender === 'female' ? 'फक्त महिलांसाठी लागू.' : 'फक्त पुरुषांसाठी लागू.');
    }
  }

  if (rule.location && profile.location) {
    if (!rule.location.some((loc) => profile.location!.toLowerCase().includes(loc.toLowerCase()))) {
      reasons.push(`फक्त ${rule.location.join(', ')} साठी लागू.`);
    }
  }

  return { eligible: reasons.length === 0, reasons };
}


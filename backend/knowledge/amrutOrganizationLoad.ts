/**
 * Loads amrut_organization_info.json into a synthetic Scheme for retrieval/injection
 * and into RawKnowledgeRecord(s) for the normalized knowledge snapshot.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { RawKnowledgeRecord } from '../services/knowledgeBase/normalizer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const ORG_FILE = path.join(ROOT, 'amrut_organization_info.json');

const SCHEME_ID = 'amrut-organization';

interface OrgFullName {
  en?: string;
  mr?: string;
  abbreviation?: string;
  shortNameMr?: string;
}

interface OrgJson {
  organization?: {
    fullName?: OrgFullName;
    establishment?: Record<string, unknown>;
    legalStatus?: Record<string, unknown>;
    purpose?: { en?: string; mr?: string };
    targetGroup?: { en?: string[]; mr?: string[] };
    headquartersAddress?: Record<string, unknown>;
    contactInformation?: Record<string, unknown>;
    governance?: Record<string, unknown>;
    focusAreas?: Record<string, unknown>;
    keyPrograms?: unknown[];
    similarOrganizations?: Record<string, unknown>;
    eligibilityCriteria?: { general?: { en?: string; mr?: string }[] };
    applicationProcess?: Record<string, unknown>;
    commonlyRequiredDocuments?: { en?: string; mr?: string }[];
    impactAndReach?: Record<string, unknown>;
    collaborations?: unknown[];
    keyFeatures?: { en?: string; mr?: string }[];
    whatMakesAmrutUnique?: { en?: string[]; mr?: string[] };
    faqs?: { questionEn?: string; questionMr?: string; answerEn?: string; answerMr?: string }[];
  };
  metadata?: Record<string, unknown>;
}

function clean(value: unknown): string {
  return String(value ?? '')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function linesFromPairs(pairs: { label: string; en?: string; mr?: string }[]): string {
  return pairs
    .map(({ label, en, mr }) => {
      const bits = [mr && `${label} (MR): ${mr}`, en && `${label} (EN): ${en}`].filter(Boolean);
      return bits.join('\n');
    })
    .filter(Boolean)
    .join('\n');
}

function flattenOrganization(org: NonNullable<OrgJson['organization']>): string {
  const fn = org.fullName || {};
  const est = org.establishment || {};
  const legal = org.legalStatus || {};
  const hq = org.headquartersAddress || {};
  const contact = org.contactInformation || {};
  const gov = org.governance || {};
  const purpose = org.purpose || {};
  const tg = org.targetGroup || {};

  const sections: string[] = [];

  sections.push(
    linesFromPairs([
      { label: 'नाव / Name', en: clean(fn.en), mr: clean(fn.mr) },
      { label: 'लघुनाव', en: clean(fn.abbreviation), mr: clean(fn.shortNameMr) },
    ]),
  );

  const estBits = [
    clean((est as { dateDisplay?: string }).dateDisplay),
    clean((est as { governmentResolution?: string }).governmentResolution),
    clean((est as { departmentMr?: string }).departmentMr),
    clean((est as { department?: string }).department),
    clean((est as { resolutionNumber?: string }).resolutionNumber),
    clean((est as { date?: string }).date),
  ].filter(Boolean);
  if (estBits.length) sections.push(`स्थापना / Establishment:\n${estBits.join('\n')}`);

  const legalType = clean((legal as { typeMr?: string }).typeMr) || clean((legal as { type?: string }).type);
  const regMr = (legal as { registeredUnderMr?: string[] }).registeredUnderMr;
  const regEn = (legal as { registeredUnder?: string[] }).registeredUnder;
  const legalLines = [legalType];
  if (regMr?.length) legalLines.push(`नोंदणी (MR): ${regMr.join('; ')}`);
  if (regEn?.length) legalLines.push(`Registered under (EN): ${regEn.join('; ')}`);
  sections.push(`कायदेशीर स्थिती:\n${legalLines.filter(Boolean).join('\n')}`);
  sections.push(linesFromPairs([{ label: 'उद्देश', en: clean(purpose.en), mr: clean(purpose.mr) }]));

  const mrTargets = (tg.mr || []).map((x) => clean(x)).filter(Boolean);
  const enTargets = (tg.en || []).map((x) => clean(x)).filter(Boolean);
  if (mrTargets.length) sections.push(`लक्षित गट (MR):\n${mrTargets.join('\n')}`);
  if (enTargets.length) sections.push(`Target group (EN):\n${enTargets.join('\n')}`);

  sections.push(
    linesFromPairs([
      {
        label: 'पत्ता',
        en: clean((hq as { fullAddressEn?: string }).fullAddressEn),
        mr: clean((hq as { fullAddressMr?: string }).fullAddressMr),
      },
    ]),
  );

  const social = (contact as { socialMedia?: Record<string, string> }).socialMedia || {};
  sections.push(
    [
      `फोन: ${clean((contact as { phone?: string }).phone)}`,
      `ईमेल: ${clean((contact as { email?: string }).email)}`,
      `वेबसाइट: ${clean((contact as { website?: string }).website)}`,
      `अर्ज पोर्टल: ${clean((contact as { applicationPortal?: string }).applicationPortal)}`,
      Object.keys(social).length ? `सोशल: ${JSON.stringify(social)}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  );

  sections.push(`शासन / Governance:\n${clean(JSON.stringify(gov, null, 2))}`);
  sections.push(`केंद्रबिंदू / Focus:\n${clean(JSON.stringify(org.focusAreas, null, 2))}`);

  if (Array.isArray(org.keyPrograms)) {
    sections.push(`मुख्य कार्यक्रम:\n${clean(JSON.stringify(org.keyPrograms, null, 2))}`);
  }
  if (org.similarOrganizations) {
    sections.push(`तत्सम संस्था:\n${clean(JSON.stringify(org.similarOrganizations, null, 2))}`);
  }

  const gen = org.eligibilityCriteria?.general || [];
  if (gen.length) {
    sections.push(
      'सामान्य पात्रता:\n' +
        gen.map((g) => [clean(g.mr), clean(g.en)].filter(Boolean).join(' | ')).join('\n'),
    );
  }

  sections.push(`अर्ज प्रक्रिया:\n${clean(JSON.stringify(org.applicationProcess, null, 2))}`);

  const docs = org.commonlyRequiredDocuments || [];
  if (docs.length) {
    sections.push(
      'सामान्य कागदपत्रे:\n' + docs.map((d) => [clean(d.mr), clean(d.en)].filter(Boolean).join(' | ')).join('\n'),
    );
  }

  if (org.collaborations?.length) {
    sections.push(`सहकार्य:\n${clean(JSON.stringify(org.collaborations, null, 2))}`);
  }

  const kf = org.keyFeatures || [];
  if (kf.length) {
    sections.push(
      'वैशिष्ट्ये:\n' + kf.map((f) => [clean(f.mr), clean(f.en)].filter(Boolean).join(' | ')).join('\n'),
    );
  }

  const uniq = org.whatMakesAmrutUnique || {};
  const mrU = (uniq.mr || []).map((x) => clean(x)).filter(Boolean);
  const enU = (uniq.en || []).map((x) => clean(x)).filter(Boolean);
  if (mrU.length) sections.push(`अमृत वैशिष्ट्ये (MR):\n${mrU.join('\n')}`);
  if (enU.length) sections.push(`What makes AMRUT unique (EN):\n${enU.join('\n')}`);

  const faqs = org.faqs || [];
  if (faqs.length) {
    sections.push(
      'वारंवार विचारले जाणारे प्रश्न / FAQs:\n' +
        faqs
          .map((f) => {
            const q = [clean(f.questionMr), clean(f.questionEn)].filter(Boolean).join(' / ');
            const a = [clean(f.answerMr), clean(f.answerEn)].filter(Boolean).join('\n');
            return q ? `Q: ${q}\nA: ${a}` : a;
          })
          .join('\n\n'),
    );
  }

  return sections.filter(Boolean).join('\n\n').replace(/\n{4,}/g, '\n\n\n').trim();
}

/** Synthetic catalog entry: merged into scheme list for voice + /api/schemes */
export function tryLoadAmrutOrganizationScheme():
  | {
      id: string;
      category: string;
      nameMr: string;
      nameHi: string;
      nameEn: string;
      description: string;
      eligibility: {
        income?: { max: number; currency: 'INR' };
        age?: { min: number; max: number };
        category?: string[];
        gender?: 'male' | 'female' | 'all';
        location?: string[];
      };
      benefits: string[];
      documentsRequired: string[];
      applicationProcess: string;
      officialWebsite?: string;
      helplineNumber?: string;
      schemeStartDate?: string;
      applicationDeadline?: string;
    }
  | null {
  try {
    if (!fs.existsSync(ORG_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(ORG_FILE, 'utf-8')) as OrgJson;
    const org = raw.organization;
    if (!org) return null;

    const fn = org.fullName || {};
    const nameMr =
      clean(fn.mr) ||
      clean(fn.shortNameMr) ||
      'अमृत — महाराष्ट्र संशोधन, उन्नती व प्रशिक्षण प्रबोधनी';
    const nameEn = clean(fn.en) || 'AMRUT — Academy of Maharashtra Research, Upliftment and Training';
    const contact = org.contactInformation || {};
    const website = clean((contact as { website?: string }).website);
    const phone = clean((contact as { phoneDisplay?: string }).phoneDisplay) || clean((contact as { phone?: string }).phone);
    const appProc = org.applicationProcess || {};
    const steps = (appProc as { steps?: { mr?: string; en?: string }[] }).steps || [];
    const processLines = steps.map((s, i) => `${i + 1}. ${clean(s.mr) || clean(s.en)}`).filter(Boolean);

    const docs = (org.commonlyRequiredDocuments || [])
      .map((d) => clean(d.mr) || clean(d.en))
      .filter(Boolean);

    const benefits = (org.keyFeatures || [])
      .map((k) => clean(k.mr) || clean(k.en))
      .filter(Boolean);

    const eligibilityLines = (org.eligibilityCriteria?.general || [])
      .map((g) => clean(g.mr) || clean(g.en))
      .filter(Boolean);

    const description = flattenOrganization(org);

    return {
      id: SCHEME_ID,
      category: 'general',
      nameMr,
      nameHi: nameMr,
      nameEn,
      description: description || nameMr,
      eligibility: {
        income: { max: 800000, currency: 'INR' },
        gender: 'all',
      },
      benefits: benefits.length ? benefits : eligibilityLines.slice(0, 3),
      documentsRequired: docs,
      applicationProcess:
        processLines.join('\n') ||
        clean((appProc as { modeMr?: string }).modeMr) ||
        clean((appProc as { mode?: string }).mode) ||
        'अर्ज https://app.mahaamrut.org.in वर ऑनलाइन.',
      officialWebsite: website || 'https://www.mahaamrut.org.in',
      helplineNumber: phone.replace(/\D/g, '').slice(-10) || undefined,
      schemeStartDate: '2019-08-22',
      applicationDeadline: undefined,
    };
  } catch {
    return null;
  }
}

const KB_TITLE = 'अमृत संस्था — AMRUT (माहिती व संपर्क)';
const KB_URL = 'https://www.mahaamrut.org.in/';

/** Extra records for POST /knowledge-base/update and kb:update */
export function tryLoadAmrutOrganizationRawRecords(): RawKnowledgeRecord[] {
  const scheme = tryLoadAmrutOrganizationScheme();
  if (!scheme) return [];
  const body = scheme.description;
  const maxChunk = 9500;
  if (body.length <= maxChunk) {
    return [
      {
        title: KB_TITLE,
        description: body,
        source: 'public',
        url: KB_URL,
      },
    ];
  }
  const chunks: string[] = [];
  for (let i = 0; i < body.length; i += maxChunk) {
    chunks.push(body.slice(i, i + maxChunk));
  }
  return chunks.map((chunk, i) => ({
    title: chunks.length > 1 ? `${KB_TITLE} (भाग ${i + 1}/${chunks.length})` : KB_TITLE,
    description: chunk,
    source: 'public' as const,
    url: KB_URL,
  }));
}

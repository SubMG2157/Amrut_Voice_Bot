import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { RawKnowledgeRecord, RawKnowledgeSnapshot } from './normalizer.js';
import { tryLoadAmrutOrganizationRawRecords } from '../../knowledge/amrutOrganizationLoad.js';

interface RawSchemePortalRow {
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
  address?: string | null;
  helplineNumber?: string | null;
  email?: string | null;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_DATA_FILE = path.join(ROOT, 'scheme_description.json');

function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/_x000D_/g, '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[~]+/g, '')
    .trim();
}

function pickUrl(row: RawSchemePortalRow): string {
  const source = cleanText(row.officialWebsite || row.application_address || '');
  const hit = source.match(/https?:\/\/[^\s)"]+/i)?.[0];
  return hit || 'https://mahaamrut.org.in/';
}

function toRecord(row: RawSchemePortalRow): RawKnowledgeRecord | null {
  const name = cleanText(row.nameMr || row.nameEn || row.nameHi || row.name);
  const description = cleanText(row.description);
  const eligibility = cleanText(row.eligibility);
  const benefits = cleanText(row.benefits);
  const documents = cleanText(row.documentsRequired || row.documents);
  const process = cleanText(row.applicationProcess || row.process);

  const title = name || description.slice(0, 120);
  if (!title) return null;

  const metaBits = [
    row.category ? `Category: ${cleanText(row.category)}` : '',
    row.helplineNumber ? `Helpline: ${cleanText(row.helplineNumber)}` : '',
    row.email ? `Email: ${cleanText(row.email)}` : '',
    row.address ? `Address: ${cleanText(row.address)}` : '',
  ].filter(Boolean);

  const stitched = [description, eligibility, benefits, documents, process, ...metaBits]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 4000);

  return {
    title,
    description: stitched || title,
    url: pickUrl(row),
    source: 'public',
  };
}

export async function loadSchemePortalFileAsRaw(
  inputPath = DEFAULT_DATA_FILE,
): Promise<RawKnowledgeSnapshot> {
  const startedAt = new Date().toISOString();
  const warnings: string[] = [];

  const resolved = path.isAbsolute(inputPath) ? inputPath : path.join(ROOT, inputPath);
  const content = await fs.readFile(resolved, 'utf-8');
  const parsed = JSON.parse(content) as unknown;
  const rows: RawSchemePortalRow[] = Array.isArray(parsed)
    ? (parsed as RawSchemePortalRow[])
    : (parsed as { schemes?: unknown })?.schemes && Array.isArray((parsed as { schemes?: unknown }).schemes)
    ? ((parsed as { schemes: RawSchemePortalRow[] }).schemes)
    : [];
  if (!rows.length) {
    throw new Error('scheme_description.json must contain either a JSON array or an object with a "schemes" array.');
  }

  const records = rows
    .map(toRecord)
    .filter((r): r is RawKnowledgeRecord => !!r);

  const unique = new Map<string, RawKnowledgeRecord>();
  for (const record of records) {
    const key = `${record.title.toLowerCase()}|${record.url}`;
    if (!unique.has(key)) unique.set(key, record);
  }

  for (const extra of tryLoadAmrutOrganizationRawRecords()) {
    const key = `${extra.title.toLowerCase()}|${extra.url}`;
    if (!unique.has(key)) unique.set(key, extra);
  }

  const merged = Array.from(unique.values());
  const endedAt = new Date().toISOString();
  return {
    startedAt,
    endedAt,
    totalPages: 1,
    totalSchemes: merged.length,
    records: merged,
    warnings,
  };
}


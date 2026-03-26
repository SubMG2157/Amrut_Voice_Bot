import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { NormalizedKnowledge } from './normalizer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const STORE_DIR = path.join(ROOT, 'backend', 'knowledge-store');
const RAW_FILE = path.join(STORE_DIR, 'raw-latest.json');
const NORMALIZED_FILE = path.join(STORE_DIR, 'normalized-latest.json');

async function ensureStoreDir(): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true });
}

export async function saveKnowledgeSnapshot(raw: unknown, normalized: NormalizedKnowledge): Promise<void> {
  await ensureStoreDir();
  await fs.writeFile(RAW_FILE, JSON.stringify(raw, null, 2), 'utf-8');
  await fs.writeFile(NORMALIZED_FILE, JSON.stringify(normalized, null, 2), 'utf-8');
}

export async function loadNormalizedKnowledge(): Promise<NormalizedKnowledge | null> {
  try {
    const content = await fs.readFile(NORMALIZED_FILE, 'utf-8');
    return JSON.parse(content) as NormalizedKnowledge;
  } catch {
    return null;
  }
}

export async function getKnowledgeStoreStats(): Promise<{
  storeDir: string;
  hasRaw: boolean;
  hasNormalized: boolean;
  normalizedSchemes: number;
  generatedAt: string | null;
}> {
  const normalized = await loadNormalizedKnowledge();
  let hasRaw = false;
  let hasNormalized = false;
  try {
    await fs.access(RAW_FILE);
    hasRaw = true;
  } catch {
    hasRaw = false;
  }
  try {
    await fs.access(NORMALIZED_FILE);
    hasNormalized = true;
  } catch {
    hasNormalized = false;
  }
  return {
    storeDir: STORE_DIR,
    hasRaw,
    hasNormalized,
    normalizedSchemes: normalized?.schemes.length ?? 0,
    generatedAt: normalized?.generatedAt ?? null,
  };
}


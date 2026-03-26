import { normalizeScrapeResult } from '../services/knowledgeBase/normalizer.js';
import { saveKnowledgeSnapshot } from '../services/knowledgeBase/store.js';
import { loadSchemePortalFileAsRaw } from '../services/knowledgeBase/localSchemeSource.js';

async function main() {
  const raw = await loadSchemePortalFileAsRaw();
  const normalized = normalizeScrapeResult(raw);
  await saveKnowledgeSnapshot(raw, normalized);
  console.log('[KB] Update completed');
  console.log('[KB] Pages:', raw.totalPages);
  console.log('[KB] Schemes:', normalized.stats.totalSchemes);
  if (raw.warnings.length) {
    console.log('[KB] Warnings:');
    raw.warnings.forEach((w) => console.log(` - ${w}`));
  }
}

main().catch((error) => {
  console.error('[KB] Update failed:', (error as Error).message);
  process.exitCode = 1;
});


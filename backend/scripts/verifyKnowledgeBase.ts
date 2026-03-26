import { loadNormalizedKnowledge } from '../services/knowledgeBase/store.js';

async function main() {
  const data = await loadNormalizedKnowledge();
  if (!data) {
    throw new Error('No normalized knowledge file found.');
  }

  if (!Array.isArray(data.schemes)) {
    throw new Error('Invalid format: schemes must be an array.');
  }

  const invalid = data.schemes.filter((s) => !s.id || !s.title || !s.category);
  if (invalid.length > 0) {
    throw new Error(`Invalid records found: ${invalid.length}`);
  }

  console.log('[KB Verify] OK');
  console.log('[KB Verify] Total schemes:', data.schemes.length);
  console.log('[KB Verify] Categories:', Object.keys(data.stats.byCategory).join(', ') || '(none)');
}

main().catch((error) => {
  console.error('[KB Verify] Failed:', (error as Error).message);
  process.exitCode = 1;
});


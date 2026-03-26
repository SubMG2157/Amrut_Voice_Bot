import { Router } from 'express';
import { normalizeScrapeResult } from '../services/knowledgeBase/normalizer.js';
import {
  getKnowledgeStoreStats,
  loadNormalizedKnowledge,
  saveKnowledgeSnapshot,
} from '../services/knowledgeBase/store.js';
import { loadSchemePortalFileAsRaw } from '../services/knowledgeBase/localSchemeSource.js';

const router = Router();

let running = false;
let lastRun: null | {
  startedAt: string;
  endedAt?: string;
  status: 'running' | 'success' | 'failed';
  error?: string;
} = null;

router.post('/update', async (_req, res) => {
  if (running) {
    res.status(409).json({ ok: false, message: 'Knowledge update already running.' });
    return;
  }

  running = true;
  lastRun = { startedAt: new Date().toISOString(), status: 'running' };
  try {
    const raw = await loadSchemePortalFileAsRaw();
    const normalized = normalizeScrapeResult(raw);
    await saveKnowledgeSnapshot(raw, normalized);
    lastRun = {
      startedAt: raw.startedAt,
      endedAt: raw.endedAt,
      status: 'success',
    };
    res.json({
      ok: true,
      rawSummary: {
        totalPages: raw.totalPages,
        totalSchemes: raw.totalSchemes,
        warnings: raw.warnings,
      },
      normalizedSummary: normalized.stats,
    });
  } catch (error) {
    lastRun = {
      startedAt: lastRun?.startedAt || new Date().toISOString(),
      endedAt: new Date().toISOString(),
      status: 'failed',
      error: (error as Error).message,
    };
    res.status(500).json({ ok: false, error: (error as Error).message });
  } finally {
    running = false;
  }
});

router.get('/status', (_req, res) => {
  res.json({
    ok: true,
    running,
    lastRun,
  });
});

router.get('/stats', async (_req, res) => {
  const stats = await getKnowledgeStoreStats();
  res.json({ ok: true, ...stats });
});

router.get('/data', async (_req, res) => {
  const data = await loadNormalizedKnowledge();
  res.json({ ok: true, data });
});

export default router;


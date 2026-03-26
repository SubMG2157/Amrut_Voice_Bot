/**
 * अमृत सरकारी योजना पोर्टल Bot — Plivo Outbound Backend
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { startCall } from './twilio/callStarter.js';
import { voiceWebhook } from './twilio/voiceWebhook.js';
import { handleTwilioStatus } from './twilio/statusHandler.js';
import { handleMediaConnection, handleUiSyncConnection, setPendingStreamCallSid } from './twilio/mediaStream.js';
import { setCallContext } from './twilio/callContext.js';
import WebSocket from 'ws';
import { initFileLogger } from './services/fileLogger.js';
import {
  SCHEME_CATEGORIES,
  evaluateEligibility,
  findSchemeById,
  findSchemeByQuery,
  getAllSchemes,
  getSchemesByCategory,
} from './knowledge/schemeCatalog.js';
import {
  translateToEnglish,
  translateToHindi,
  translateToMarathi,
} from './services/translationService.js';
import knowledgeBaseRoutes from './api/knowledgeBaseRoutes.js';

// Load .env from project root and backend/
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });

// Initialize file logger — all console output goes to logs/logs.txt
initFileLogger();

const PORT = Number(process.env.PORT) || Number(process.env.BACKEND_PORT) || 3001;
const BASE_URL = process.env.BACKEND_BASE_URL || `http://localhost:${PORT}`;
const plivoOk = !!(process.env.PLIVO_AUTH_ID && process.env.PLIVO_AUTH_TOKEN && process.env.PLIVO_NUMBER);
console.log('Plivo:', plivoOk ? 'LOADED' : 'MISSING (set PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN, PLIVO_NUMBER in .env or backend/.env)');
if (plivoOk && (BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1'))) {
  console.warn('BACKEND_BASE_URL is localhost — Plivo cannot reach it. Set BACKEND_BASE_URL to your ngrok URL (e.g. https://xxxx.ngrok-free.app) in .env or backend/.env');
}

const app = express();

// CORS: allow frontend from any origin (ngrok, localhost, customer PCs)
app.use(cors({
  origin: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ——— API: Start outbound call ———
app.post('/api/call', async (req, res) => {
  console.log('CALL API HIT', req.body);
  try {
    const { phone, name, category, language, agentGender } = req.body;
    if (!phone) {
      res.status(400).json({ error: 'phone required' });
      return;
    }
    const context = {
      userName: name || 'नागरिक',
      schemeCategory: category || 'general',
      language: language || 'Marathi',
      agentGender: agentGender ?? 'female',
      purpose: 'scheme_information' as const,
    };
    const call = await startCall(phone, context);
    setCallContext(call.id, { ...context, phone });
    res.json({
      callId: call.id,
      status: 'initiated',
      message: 'Call initiated via Plivo',
    });
  } catch (err: any) {
    console.error('Start call error:', err);
    res.status(500).json({ error: err?.message || 'Failed to start call' });
  }
});

app.get('/api/schemes/categories', (_req, res) => {
  res.json({ categories: SCHEME_CATEGORIES });
});

app.get('/api/schemes', (_req, res) => {
  res.json({ schemes: getAllSchemes() });
});

app.get('/api/schemes/category/:categoryId', (req, res) => {
  const schemes = getSchemesByCategory(req.params.categoryId);
  res.json({ categoryId: req.params.categoryId, schemes });
});

app.get('/api/schemes/search', (req, res) => {
  const query = String(req.query.q || '').trim();
  if (!query) {
    res.status(400).json({ error: 'q query parameter is required' });
    return;
  }
  res.json({ query, schemes: findSchemeByQuery(query) });
});

app.get('/api/schemes/:schemeId', (req, res) => {
  const scheme = findSchemeById(req.params.schemeId);
  if (!scheme) {
    res.status(404).json({ error: 'scheme not found' });
    return;
  }
  res.json({ scheme });
});

app.post('/api/schemes/:schemeId/check-eligibility', (req, res) => {
  const scheme = findSchemeById(req.params.schemeId);
  if (!scheme) {
    res.status(404).json({ error: 'scheme not found' });
    return;
  }
  const result = evaluateEligibility(scheme, req.body || {});
  res.json({ schemeId: scheme.id, ...result });
});

// Compatibility alias for older UI naming.
app.get('/api/departments', (_req, res) => {
  res.json({
    departments: SCHEME_CATEGORIES.map((c) => ({
      id: c.id,
      nameMr: c.nameMr,
      nameEn: c.nameEn,
      description: c.description,
    })),
  });
});

app.post('/api/translate', async (req, res) => {
  try {
    const { text, target } = req.body;
    if (!text) return res.json({ text: '' });
    if (target === 'en') {
      const result = await translateToEnglish(text);
      return res.json({ text: result });
    } else if (target === 'hi') {
      const result = await translateToHindi(text);
      return res.json({ text: result });
    } else {
      const result = await translateToMarathi(text);
      return res.json({ text: result });
    }
  } catch(e) {
    res.status(500).json({ error: 'Translation failed' });
  }
});

// Knowledge base routes
app.use('/api/knowledge-base', knowledgeBaseRoutes);

// ——— Plivo webhooks ———
app.post('/plivo/answer', (req, res) => {
  res.type('text/xml');
  const callId = (req.body && (req.body.CallUUID || req.body.CallSid || req.body.call_uuid)) || '';
  if (callId) setPendingStreamCallSid(callId);
  res.send(voiceWebhook(BASE_URL, callId));
});

app.post('/plivo/status', (req, res) => {
  handleTwilioStatus(req.body);
  res.sendStatus(200);
});

app.post('/plivo/sms-status', (req, res) => {
  console.log('[Plivo] SMS status:', req.body);
  res.sendStatus(200);
});

// Backward-compatible aliases while migrating dashboards/tools.
app.post('/twilio/voice', (req, res) => {
  res.type('text/xml');
  const callId = (req.body && (req.body.CallUUID || req.body.CallSid || req.body.call_uuid)) || '';
  if (callId) setPendingStreamCallSid(callId);
  res.send(voiceWebhook(BASE_URL, callId));
});

app.post('/twilio/status', (req, res) => {
  handleTwilioStatus(req.body);
  res.sendStatus(200);
});

// ——— Health ———
app.get('/health', (_, res) => res.json({ ok: true }));

// ——— Serve built frontend (dist/) so both run on one port + one ngrok URL ———
const distPath = path.join(root, 'dist');
app.use(express.static(distPath));
// SPA fallback: any route that isn't /api, /twilio, /health, /media, /ui-sync → serve index.html
app.get('*', (req, res) => {
  const p = req.path;
  if (p.startsWith('/api') || p.startsWith('/twilio') || p.startsWith('/plivo') || p.startsWith('/health')) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

const httpServer = createServer(app);

// WebSocket servers with noServer so we own the upgrade and strip extensions.
const wssMedia = new WebSocketServer({ noServer: true, perMessageDeflate: false });
const wssUiSync = new WebSocketServer({ noServer: true, perMessageDeflate: false });
const wssGeminiProxy = new WebSocketServer({ noServer: true, perMessageDeflate: false });

httpServer.on('upgrade', (req, socket, head) => {
  delete (req.headers as Record<string, string>)['sec-websocket-extensions'];
  const pathname = req.url?.split('?')[0] ?? '';
  const normalizedPathname = pathname.replace(/^\/+/, '/');
  const isGeminiBidiPath =
    /^\/ws\/google\.ai\.generativelanguage\.[^.]+\.GenerativeService\.BidiGenerateContent\/?$/.test(normalizedPathname);
  if (pathname === '/media') {
    wssMedia.handleUpgrade(req, socket, head, (ws) => {
      wssMedia.emit('connection', ws, req);
    });
  } else if (pathname === '/ui-sync') {
    wssUiSync.handleUpgrade(req, socket, head, (ws) => {
      wssUiSync.emit('connection', ws, req);
    });
  } else if (isGeminiBidiPath) {
    console.log('[WS] Gemini BidiGenerateContent upgrade accepted:', pathname);
    wssGeminiProxy.handleUpgrade(req, socket, head, (ws) => {
      wssGeminiProxy.emit('connection', ws, req);
    });
  } else {
    console.warn('[WS] Upgrade rejected for path:', pathname);
    socket.destroy();
  }
});

wssMedia.on('connection', (ws, req) => {
  const ext = (ws as any).extensions;
  console.log('[MediaStream] WS /media connected, extensions:', ext === undefined || ext === '' ? '(none)' : ext);
  handleMediaConnection(ws, req);
});

wssUiSync.on('connection', (ws) => {
  handleUiSyncConnection(ws);
});

wssGeminiProxy.on('connection', (clientWs, req) => {
  console.log('[GeminiProxy] New proxy connection from browser');
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[GeminiProxy] Missing API_KEY in backend env');
    clientWs.close();
    return;
  }
  const normalizedPath = (req.url?.split('?')[0] || '').replace(/^\/+/, '/');
  const targetUrl = `wss://generativelanguage.googleapis.com${normalizedPath}?key=${apiKey}`;
  const geminiWs = new WebSocket(targetUrl);

  const messageQueue: { data: any; isBinary: boolean }[] = [];

  geminiWs.on('open', () => {
    console.log('[GeminiProxy] Connected to Google Gemini');
    // Flush queued messages
    while (messageQueue.length > 0) {
      const msg = messageQueue.shift();
      if (msg) geminiWs.send(msg.data, { binary: msg.isBinary });
    }
  });

  geminiWs.on('message', (data, isBinary) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data, { binary: isBinary });
    }
  });

  clientWs.on('message', (data, isBinary) => {
    if (geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.send(data, { binary: isBinary });
    } else {
      messageQueue.push({ data, isBinary });
    }
  });

  geminiWs.on('close', () => {
    clientWs.close();
  });

  clientWs.on('close', () => {
    geminiWs.close();
  });

  geminiWs.on('error', (err) => {
    console.error('[GeminiProxy] Target WS error:', err);
    clientWs.close();
  });

  clientWs.on('error', (err) => {
    console.error('[GeminiProxy] Client WS error:', err);
    geminiWs.close();
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 अमृत सरकारी योजना पोर्टल Agent — Running on port ${PORT}`);
  console.log(`──────────────────────────────────────────`);
  console.log(`  🌐 Frontend:  http://localhost:${PORT}`);
  console.log(`  📡 API:       http://localhost:${PORT}/api/...`);
  console.log(`  📞 Plivo:     ${BASE_URL}/plivo/answer`);
  console.log(`  🔗 ngrok URL: ${BASE_URL}`);
  console.log(`──────────────────────────────────────────`);
  console.log(`  Share this with customers: ${BASE_URL}`);
  console.log(`──────────────────────────────────────────\n`);
});

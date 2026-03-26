import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AgentGender, ConnectionState, Language, TranscriptItem } from './types';
import { LiveClient } from './services/liveClient';
import Visualizer from './components/Visualizer';
import TranscriptBubble from './components/TranscriptBubble';
import { exportTranscriptCSV, exportTranscriptPDF } from './services/transcriptExport';
import type { Scheme } from './backend/knowledge/schemeCatalog.ts';

const DEFAULT_LANGUAGE = Language.MARATHI;
const DEFAULT_CATEGORY = 'general';
const DEFAULT_AGENT: AgentGender = 'female';
const API_BASE = (import.meta as any).env?.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');

const App: React.FC = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [volumes, setVolumes] = useState({ input: 0, output: 0 });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [agentGenderSelection, setAgentGenderSelection] = useState<AgentGender>(DEFAULT_AGENT);

  const clientRef = useRef<LiveClient | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const availableSchemesRef = useRef<Scheme[] | undefined>(undefined);

  const isCallActive = connectionState === 'connected' || connectionState === 'connecting';
  const agentDisplayName = agentGenderSelection === 'male' ? 'Rajesh' : 'Priya';

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcripts]);

  const handleTranscript = useCallback((text: string, source: 'user' | 'model', isFinal: boolean) => {
    if (!isFinal || !text.trim()) return;
    const entryId = crypto.randomUUID?.() ?? Date.now().toString();
    setTranscripts((prev) => [...prev, { id: entryId, source, text: text.trim(), timestamp: new Date() }]);
  }, []);

  const handleVolume = useCallback((input: number, output: number) => {
    setVolumes({ input, output });
  }, []);

  const startDemo = async () => {
    setConnectionState('connecting');
    setErrorMsg(null);
    setTranscripts([]);
    let failed = false;

    if (!availableSchemesRef.current || availableSchemesRef.current.length === 0) {
      try {
        const res = await fetch(`${API_BASE}/api/schemes`);
        const data = await res.json();
        if (res.ok && Array.isArray(data?.schemes) && data.schemes.length > 0) {
          availableSchemesRef.current = data.schemes as Scheme[];
        }
      } catch {
        // Fallback to prompt seed in liveClient if backend schemes are unavailable.
      }
    }

    const client = new LiveClient({
      language: DEFAULT_LANGUAGE,
      patientName: 'नागरिक',
      departmentName: DEFAULT_CATEGORY,
      availableSchemes: availableSchemesRef.current,
      agentGender: agentGenderSelection,
      onTranscript: handleTranscript,
      onVolumeUpdate: handleVolume,
      onClose: () => {
        setConnectionState('disconnected');
      },
      onError: (err) => {
        failed = true;
        const msg = err?.message || 'Connection error. Ensure backend is running and GEMINI_API_KEY is set.';
        setErrorMsg(msg);
        setConnectionState('error');
      },
    });

    clientRef.current = client;
    try {
      await client.connect();
      if (!failed) setConnectionState('connected');
    } catch {
      // Error state already handled in onError.
    }
  };

  const handleConnect = async () => {
    if (isCallActive) {
      clientRef.current?.disconnect();
      setConnectionState('disconnected');
      setVolumes({ input: 0, output: 0 });
      return;
    }
    await startDemo();
  };

  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-linear-to-br from-orange-50 via-white to-orange-100 text-slate-900">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_450px_at_10%_-10%,rgba(249,115,22,.20),transparent),radial-gradient(700px_420px_at_95%_0%,rgba(251,146,60,.16),transparent)]" />

      <header className="relative z-10 border-b border-orange-200/70 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-orange-200 bg-orange-100 text-xl">🤖</div>
            <h1 className="text-xl font-bold text-orange-600">अमृत सरकारी योजना पोर्टल</h1>
          </div>
          <div className="text-right text-xs text-orange-600/80">Web Demo</div>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 md:px-6 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-1">
          <div className="rounded-3xl border border-orange-200 bg-white p-6 shadow-lg shadow-orange-100/80">
            <h2 className="mb-2 text-lg font-semibold text-orange-600">AI Chatbot</h2>
            <p className="mb-4 text-sm text-slate-600">
              Voice assistant for अमृत सरकारी योजना पोर्टल. Ask naturally in Marathi, Hindi, or English.
            </p>
            <div className="mb-3 flex items-center justify-between rounded-2xl border border-orange-100 bg-orange-50 px-3 py-2 text-xs">
              <span className="font-medium text-slate-700">Agent</span>
              <button
                type="button"
                onClick={() => setAgentGenderSelection((prev) => (prev === 'female' ? 'male' : 'female'))}
                disabled={isCallActive}
                className="rounded-lg border border-orange-200 bg-white px-3 py-1 font-semibold text-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {agentDisplayName}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-orange-200 bg-white p-4 shadow-lg shadow-orange-100/80">
            <div className="mb-3 flex items-center justify-center">
              <Visualizer inputVolume={volumes.input} outputVolume={volumes.output} isConnected={connectionState === 'connected'} />
            </div>
            {errorMsg && (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {errorMsg}
              </div>
            )}
            <button
              onClick={handleConnect}
              disabled={connectionState === 'connecting'}
              className={`w-full rounded-xl px-4 py-3 text-sm font-bold transition ${
                connectionState === 'connected'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              {connectionState === 'connecting'
                ? 'Connecting...'
                : connectionState === 'connected'
                ? 'End Demo'
                : 'Start Web Demo'}
            </button>
          </div>
        </section>

        <section className="lg:col-span-2">
          <div className="flex min-h-[70vh] flex-col overflow-hidden rounded-3xl border border-orange-200 bg-white shadow-lg shadow-orange-100/80">
            <div className="flex items-center justify-between border-b border-orange-100 px-4 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-orange-600">Live Trail</h2>
              <div className="flex items-center gap-2">
                {transcripts.length > 0 && (
                  <>
                    <button onClick={() => exportTranscriptCSV(transcripts)} className="rounded border border-orange-200 bg-orange-50 px-2 py-1 text-xs text-orange-700">CSV</button>
                    <button onClick={() => exportTranscriptPDF(transcripts)} className="rounded border border-orange-200 bg-orange-50 px-2 py-1 text-xs text-orange-700">PDF</button>
                  </>
                )}
              </div>
            </div>
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
              {transcripts.length === 0 ? (
                <div className="grid h-full place-items-center py-16 text-center text-slate-500">
                  <div>
                    <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-orange-200 bg-orange-50 text-2xl">📝</div>
                    <p className="text-sm text-slate-700">Start web demo to view live user and AI conversation.</p>
                    <p className="mt-1 text-xs text-slate-500">No manual language/category selection needed.</p>
                  </div>
                </div>
              ) : (
                transcripts.map((t) => (
                  <TranscriptBubble
                    key={t.id}
                    side={t.source === 'user' ? 'customer' : 'agent'}
                    text={t.text}
                    caption={t.caption}
                    timestamp={t.timestamp.toLocaleTimeString()}
                    agentName={agentDisplayName}
                  />
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;


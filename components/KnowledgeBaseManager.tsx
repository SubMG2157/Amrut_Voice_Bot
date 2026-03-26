import React, { useEffect, useState } from 'react';

interface KnowledgeStats {
  hasRaw: boolean;
  hasNormalized: boolean;
  normalizedSchemes: number;
  generatedAt: string | null;
}

export default function KnowledgeBaseManager({ apiBase }: { apiBase: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState<KnowledgeStats | null>(null);

  const refreshStats = async () => {
    try {
      const res = await fetch(`${apiBase}/api/knowledge-base/stats`);
      const data = await res.json();
      if (data?.ok) {
        setStats({
          hasRaw: !!data.hasRaw,
          hasNormalized: !!data.hasNormalized,
          normalizedSchemes: Number(data.normalizedSchemes || 0),
          generatedAt: data.generatedAt || null,
        });
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshStats();
  }, []);

  const runUpdate = async () => {
    setLoading(true);
    setMessage('ज्ञानसंग्रह अपडेट सुरू...');
    try {
      const res = await fetch(`${apiBase}/api/knowledge-base/update`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || data?.message || 'Update failed');
      }
      setMessage(`अपडेट पूर्ण. योजना: ${data.normalizedSummary?.totalSchemes ?? 0}`);
      await refreshStats();
    } catch (error) {
      setMessage(`त्रुटी: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 w-80 rounded-2xl border border-white/10 bg-(--kims-panel) p-4 shadow-2xl shadow-black/40">
          <h3 className="mb-2 text-sm font-semibold text-white">Knowledge Base Manager</h3>
          <p className="text-xs text-slate-300">
            `scheme_description.json` फाईलवरून योजना डेटा रिफ्रेश करा.
          </p>
          <div className="mt-3 space-y-1 text-xs text-slate-300">
            <div>Raw: {stats?.hasRaw ? 'yes' : 'no'}</div>
            <div>Normalized: {stats?.hasNormalized ? 'yes' : 'no'}</div>
            <div>Schemes: {stats?.normalizedSchemes ?? 0}</div>
            <div>Generated: {stats?.generatedAt || '-'}</div>
          </div>
          {message && (
            <div className="mt-3 rounded border border-white/10 bg-black/20 px-2 py-1 text-xs text-slate-200">
              {message}
            </div>
          )}
          <button
            type="button"
            onClick={runUpdate}
            disabled={loading}
            className="mt-3 w-full rounded-lg bg-(--kims-accent) px-3 py-2 text-xs font-bold text-slate-900 disabled:opacity-60"
          >
            {loading ? 'Updating...' : 'Update Knowledge Base'}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid h-14 w-14 place-items-center rounded-full bg-(--kims-primary) text-2xl shadow-lg"
        title="Knowledge Base"
      >
        📚
      </button>
    </div>
  );
}


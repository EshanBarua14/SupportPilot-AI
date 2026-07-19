import React, { useState } from 'react';
import { KBArticle } from '../types';
import { InitialKBArticles } from '../data/simulation';
import * as Icons from 'lucide-react';

interface RunbookManagerProps {
  modelSelection: string;
  onAddAuditLog: (operator: string, action: string, module: string, status: 'SUCCESS' | 'FAILED' | 'PENDING_APPROVAL', payload: string) => void;
}

export default function RunbookManager({ modelSelection, onAddAuditLog }: RunbookManagerProps) {
  const [articles, setArticles] = useState<KBArticle[]>(InitialKBArticles);
  const [selectedArticle, setSelectedArticle] = useState<KBArticle>(InitialKBArticles[0]);
  const [search, setSearch] = useState('');

  // Batch Revert tracking states
  const [appliedRemediations, setAppliedRemediations] = useState([
    { id: 'rem-01', agent: 'L1-Triage-Alpha', step: 'Flushed Redis Query Buffers', target: 'redis-node-2', timestamp: '10 mins ago' },
    { id: 'rem-02', agent: 'L2-Db-Expert', step: 'Terminated Deadlocked PG Backend ID 4059', target: 'pg-leader-0', timestamp: '8 mins ago' },
    { id: 'rem-03', agent: 'L1-Network-Triage', step: 'Throttled Ingress Rate Limit (300 req/s)', target: 'ingress-01', timestamp: '5 mins ago' },
    { id: 'rem-04', agent: 'L2-Kube-Scheduler', step: 'Restarted Web Server Pod (Replica A)', target: 'web-prod-9a', timestamp: '2 mins ago' }
  ]);
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  const handleExecuteBatchRevert = async () => {
    if (isReverting) return;
    setIsReverting(true);
    
    // Simulate multi-node remote orchestration
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Audit and notify
    onAddAuditLog(
      "Eshan Barua (CTO)",
      "BATCH REVERT REMEDIATION",
      "Support Matrix",
      "SUCCESS",
      `Executed batch rollback on ${appliedRemediations.length} active agent hooks. Nodes reverted: redis-node-2, pg-leader-0, ingress-01, web-prod-9a`
    );

    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message: `Batch rollback successful! Reverted ${appliedRemediations.length} agent operational changes.` }
    }));

    setAppliedRemediations([]);
    setIsReverting(false);
    setShowRevertModal(false);
  };

  React.useEffect(() => {
    const handleSelect = (e: Event) => {
      const customEvent = e as CustomEvent;
      const id = customEvent.detail?.runbookId;
      if (id) {
        const found = articles.find(art => art.id === id);
        if (found) {
          setSelectedArticle(found);
        }
      }
    };
    window.addEventListener('select-runbook', handleSelect);
    return () => window.removeEventListener('select-runbook', handleSelect);
  }, [articles]);

  // AI Generation states
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genTitle, setGenTitle] = useState('');
  const [genRootCause, setGenRootCause] = useState('');
  const [genRemediation, setGenRemediation] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Custom simple Markdown renderer to avoid library imports and potential conflicts
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Headers
      if (line.startsWith('# ')) {
        return <h1 key={idx} className="font-display font-bold text-base text-indigo-400 mt-4 mb-2 border-b border-slate-800 pb-1">{line.slice(2)}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={idx} className="font-display font-bold text-sm text-slate-200 mt-4 mb-1.5">{line.slice(3)}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={idx} className="font-sans font-bold text-xs text-indigo-300 mt-3 mb-1">{line.slice(4)}</h3>;
      }
      // Bullet list
      if (line.startsWith('* ') || line.startsWith('- ')) {
        return (
          <div key={idx} className="flex items-start space-x-2 pl-2 my-1 text-slate-300">
            <span className="text-indigo-400 mt-1 shrink-0">•</span>
            <span>{line.slice(2)}</span>
          </div>
        );
      }
      // Bullet list numbered
      if (/^\d+\.\s/.test(line)) {
        const dotIdx = line.indexOf('.');
        return (
          <div key={idx} className="flex items-start space-x-2 pl-2 my-1 text-slate-300">
            <span className="text-indigo-400 font-mono font-bold text-xxs shrink-0 mt-0.5">{line.slice(0, dotIdx + 1)}</span>
            <span>{line.slice(dotIdx + 2)}</span>
          </div>
        );
      }
      // Code block lines
      if (line.startsWith('`') && line.endsWith('`')) {
        return (
          <pre key={idx} className="my-2 rounded-lg bg-slate-950 p-2.5 font-mono text-[10px] text-emerald-400 overflow-x-auto border border-emerald-500/10">
            {line.replace(/`/g, '')}
          </pre>
        );
      }
      if (line.startsWith('```')) {
        return null; // Ignore code block wrapping ticks for simplicity
      }
      // Normal paragraph
      if (line.trim() === '') {
        return <div key={idx} className="h-2" />;
      }
      return <p key={idx} className="my-1 text-slate-300 leading-relaxed">{line}</p>;
    });
  };

  const filteredArticles = articles.filter(art => 
    art.title.toLowerCase().includes(search.toLowerCase()) || 
    art.content.toLowerCase().includes(search.toLowerCase()) ||
    art.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  const handleGenerateArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genTitle.trim() || !genRootCause.trim() || isGenerating) return;

    setIsGenerating(true);
    setGenError(null);

    try {
      const response = await fetch('/api/kb/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: genTitle,
          rootCause: genRootCause,
          suggestedFix: genRemediation,
          modelSelection: modelSelection
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to synthesize article with Gemini.");
      }

      const data = await response.json();
      
      const newArticle: KBArticle = {
        id: `kb_${Date.now().toString().slice(-4)}`,
        title: genTitle,
        content: data.content,
        tags: ["AI-Generated", "L3-Runbook"],
        author: "Knowledge Agent",
        createdAt: new Date().toISOString(),
        votes: 1
      };

      setArticles(prev => [newArticle, ...prev]);
      setSelectedArticle(newArticle);
      setShowGenerateModal(false);
      
      // Clear inputs
      setGenTitle('');
      setGenRootCause('');
      setGenRemediation('');

      onAddAuditLog(
        "AI Knowledge Agent",
        "Synthesized KB Runbook",
        "Knowledge Engine",
        "SUCCESS",
        `Created markdown runbook article for issue: "${genTitle}"`
      );

    } catch (err: any) {
      console.error(err);
      setGenError(err.message || "An unexpected error occurred.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid h-[calc(100vh-130px)] grid-cols-12 gap-4 font-sans text-xs">
      
      {/* 1. ARTICLES LIST PANEL (Sidebar Left) */}
      <div className="col-span-3 flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 p-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display font-bold text-sm text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Icons.BookOpen className="h-4 w-4" />
            <span>Knowledge Index</span>
          </h3>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="rounded bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 px-2 py-1 hover:bg-indigo-600/40 font-semibold flex items-center space-x-1 text-xxs"
          >
            <Icons.Plus className="h-3 w-3" />
            <span>New with AI</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Icons.Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search runbooks, tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 pl-8 pr-3 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
          />
        </div>

        {/* Article list items */}
        <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
          {filteredArticles.map((art) => {
            const isSelected = art.id === selectedArticle.id;
            return (
              <button
                key={art.id}
                onClick={() => setSelectedArticle(art)}
                className={`w-full flex flex-col rounded-lg p-2.5 border text-left transition-all ${
                  isSelected 
                    ? 'bg-slate-950 border-indigo-500/80 shadow-indigo-500/5' 
                    : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-800/30'
                }`}
              >
                <span className="font-mono text-[9px] text-slate-500">{art.id}</span>
                <h4 className="font-bold text-white text-xxs mt-0.5 line-clamp-2 leading-relaxed">{art.title}</h4>
                <div className="flex flex-wrap gap-1 mt-2">
                  {art.tags.map(t => (
                    <span key={t} className="rounded bg-slate-800 px-1.5 py-0.5 text-[8px] text-indigo-300">
                      {t}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
          {filteredArticles.length === 0 && (
            <div className="text-center py-6 text-slate-500">No knowledge articles matched your search query.</div>
          )}
        </div>
      </div>

      {/* 2. ARTICLE READER SPACE (Middle + Right combined) */}
      <div className="col-span-9 flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        
        {/* Article header details */}
        <div className="border-b border-slate-800 bg-slate-950/40 px-6 py-4 flex items-center justify-between">
          <div>
            <span className="font-mono text-xxs text-slate-500">Author: {selectedArticle.author} | Created: {selectedArticle.createdAt.slice(0, 10)}</span>
            <h2 className="font-display font-bold text-base text-white mt-1">{selectedArticle.title}</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => {
                setArticles(prev => prev.map(a => a.id === selectedArticle.id ? { ...a, votes: a.votes + 1 } : a));
                setSelectedArticle(prev => ({ ...prev, votes: prev.votes + 1 }));
              }}
              className="flex items-center space-x-1.5 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-1.5 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/20"
            >
              <Icons.ThumbsUp className="h-3.5 w-3.5" />
              <span className="font-mono font-bold text-xxs text-slate-300">{selectedArticle.votes}</span>
            </button>
          </div>
        </div>

        {/* ACTIVE REMEDIATION HISTORY & BATCH REVERT UTILITY */}
        <div className="bg-slate-950/60 border-b border-slate-800 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="rounded bg-rose-500/15 px-2 py-0.5 font-mono text-[8.5px] font-bold text-rose-400 border border-rose-500/30 uppercase tracking-wider">
                remediation tracking pool
              </span>
              <span className="text-[9px] font-mono text-slate-500">cluster-prod-1</span>
            </div>
            <h3 className="font-display font-bold text-xs text-slate-200">Active Remediation Transaction Pool</h3>
            <p className="text-[10px] text-slate-400 leading-snug">
              {appliedRemediations.length > 0 ? (
                <>
                  There are <span className="text-rose-400 font-bold">{appliedRemediations.length} active cluster remediation hooks</span> applied by L1/L2 Copilots across multiple namespace node pools.
                </>
              ) : (
                <span className="text-slate-500 italic">No recently applied remediation changes in active buffer. System state synchronized.</span>
              )}
            </p>
          </div>
          
          <button
            onClick={() => {
              if (appliedRemediations.length > 0) {
                setShowRevertModal(true);
              }
            }}
            disabled={appliedRemediations.length === 0}
            className={`shrink-0 rounded-lg border px-3.5 py-2 font-bold transition-all flex items-center space-x-2 text-xxs ${
              appliedRemediations.length > 0
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/35 hover:bg-rose-600 hover:text-white cursor-pointer hover:shadow-lg hover:shadow-rose-500/10 active:scale-95'
                : 'bg-slate-900/50 text-slate-600 border-slate-800/80 cursor-not-allowed opacity-55'
            }`}
          >
            <Icons.Undo2 className="h-3.5 w-3.5" />
            <span>Batch Revert Hooks ({appliedRemediations.length})</span>
          </button>
        </div>

        {/* Markdown Render Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/20 select-text">
          <div className="max-w-3xl mx-auto space-y-3 prose prose-invert font-sans text-xs">
            {renderMarkdown(selectedArticle.content)}
          </div>
        </div>

      </div>

      {/* AI GENERATION TRIGGER MODAL */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <form onSubmit={handleGenerateArticle} className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 text-indigo-400 mb-4">
              <Icons.Cpu className="h-5 w-5 animate-pulse" />
              <h4 className="font-display font-bold text-sm text-white">AI Runbook Synthesizer</h4>
            </div>

            {genError && (
              <div className="mb-4 rounded border border-rose-500/20 bg-rose-500/5 p-3 font-mono text-[10px] text-rose-300">
                <div className="flex items-center space-x-1.5 font-bold mb-1">
                  <Icons.AlertTriangle className="h-4 w-4" />
                  <span>Synthesizer interlock failed</span>
                </div>
                <p>{genError}</p>
              </div>
            )}

            <div className="space-y-4 font-sans">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Outage Incident Title</label>
                <input
                  type="text"
                  placeholder="e.g. Redis Buffer Pool Cache Eviction Storm"
                  value={genTitle}
                  onChange={(e) => setGenTitle(e.target.value)}
                  required
                  className="w-full rounded border border-slate-800 bg-slate-950 p-2 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Technical Root Cause Analysis</label>
                <textarea
                  placeholder="Describe what technically failed..."
                  value={genRootCause}
                  onChange={(e) => setGenRootCause(e.target.value)}
                  rows={3}
                  required
                  className="w-full rounded border border-slate-800 bg-slate-950 p-2 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Recommended Remediation Script (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. redis-cli -p 6379 FLUSHALL"
                  value={genRemediation}
                  onChange={(e) => setGenRemediation(e.target.value)}
                  className="w-full rounded border border-slate-800 bg-slate-950 p-2 font-mono text-xxs text-emerald-300 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="mt-6 flex space-x-2">
              <button
                type="button"
                onClick={() => {
                  setShowGenerateModal(false);
                  setGenError(null);
                }}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xxs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isGenerating}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded text-xxs font-bold transition-colors flex items-center justify-center space-x-1.5"
              >
                {isGenerating ? (
                  <>
                    <Icons.Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Synthesizing KB...</span>
                  </>
                ) : (
                  <>
                    <Icons.Zap className="h-3.5 w-3.5" />
                    <span>Generate Runbook</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* BATCH REVERT CONFIRMATION MODAL */}
      {showRevertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-rose-500/10 blur-3xl" />
            
            <div className="relative flex items-center space-x-3 border-b border-slate-900 pb-4 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <Icons.Undo2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-display font-bold text-sm text-white uppercase tracking-wider">Confirm Batch Remediation Revert</h4>
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">SupportPilot Rollback Manager</p>
              </div>
            </div>

            <p className="text-xxs text-slate-400 mb-4 leading-relaxed">
              You are about to initiate a synchronized rollback of all applied remediation steps in the current transaction pool. This will undo active cluster changes and trigger agent telemetry adjustments.
            </p>

            <div className="space-y-2 max-h-[180px] overflow-y-auto bg-slate-900/40 border border-slate-900 rounded-xl p-3 mb-5 font-mono text-[10px]">
              <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-900 pb-1 flex justify-between">
                <span>REMEDIATION ITEM TO REVERT</span>
                <span>TARGET NODE</span>
              </div>
              {appliedRemediations.map((item) => (
                <div key={item.id} className="flex items-start justify-between border-b border-slate-900/50 pb-2 last:border-0 last:pb-0">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[8px] bg-slate-800 text-slate-400 px-1.5 rounded">{item.agent}</span>
                      <span className="font-bold text-rose-400">{item.step}</span>
                    </div>
                    <span className="text-[9px] text-slate-500">{item.timestamp}</span>
                  </div>
                  <span className="font-bold text-slate-300 text-right bg-slate-950 px-2 py-0.5 rounded border border-slate-900 shrink-0">
                    {item.target}
                  </span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-rose-500/10 bg-rose-500/5 p-4 mb-6 text-xxs text-rose-400/90 leading-relaxed flex items-start space-x-2.5">
              <Icons.AlertTriangle className="h-4.5 w-4.5 shrink-0 text-rose-400 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold uppercase tracking-wider block">Critical Operator Alert</span>
                <span>Rollback processes are server-authoritative and will directly influence remote ingress gateway rules, database isolation tables, and background worker threads.</span>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setShowRevertModal(false)}
                disabled={isReverting}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xxs font-bold uppercase tracking-wider cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBatchRevert}
                disabled={isReverting}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-45 text-white rounded-xl text-xxs font-bold uppercase tracking-wider cursor-pointer shadow-lg shadow-rose-600/10 transition-colors flex items-center justify-center space-x-1.5"
              >
                {isReverting ? (
                  <>
                    <Icons.Loader2 className="h-4 w-4 animate-spin" />
                    <span>Executing Rollback...</span>
                  </>
                ) : (
                  <>
                    <Icons.ShieldCheck className="h-4 w-4" />
                    <span>Confirm Rollback</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

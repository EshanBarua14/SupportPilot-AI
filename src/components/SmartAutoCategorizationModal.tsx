import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';
import { Incident } from '../types';

interface SmartAutoCategorizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIncidents: Incident[];
  onApplyCategoryLabels: (updates: Array<{ id: string; primaryCategory: string; secondaryTags: string[] }>) => void;
  onAddAuditLog?: (user: string, action: string, area: string, status: 'SUCCESS' | 'FAILED' | 'PENDING_APPROVAL', details: string) => void;
}

interface SuggestionItem {
  primaryCategory: string;
  secondaryTags: string[];
  confidenceScore: number;
  reasoning: string;
}

export function SmartAutoCategorizationModal({
  isOpen,
  onClose,
  selectedIncidents,
  onApplyCategoryLabels,
  onAddAuditLog
}: SmartAutoCategorizationModalProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, SuggestionItem>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && selectedIncidents.length > 0) {
      setSelectedIds(selectedIncidents.map(i => i.id));
      fetchSmartCategorization();
    }
  }, [isOpen, selectedIncidents]);

  const fetchSmartCategorization = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/smart-auto-categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidents: selectedIncidents })
      });
      const data = await response.json();
      if (data && data.suggestions) {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      console.error("[Smart Categorization] API call failed:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleApply = () => {
    const updates = selectedIds.map(id => {
      const sugg = suggestions[id];
      return {
        id,
        primaryCategory: sugg?.primaryCategory || 'Uncategorized Incident',
        secondaryTags: sugg?.secondaryTags || ['auto-tagged']
      };
    });

    onApplyCategoryLabels(updates);

    if (onAddAuditLog) {
      onAddAuditLog(
        'Eshan Barua (CTO)',
        'Smart AI Auto-Categorization Applied',
        'IncidentWorkspace',
        'SUCCESS',
        `Applied AI-suggested categories and telemetry tags to ${selectedIds.length} incident(s).`
      );
    }

    onClose();
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-3xl rounded-2xl border border-indigo-500/40 bg-slate-950 p-6 shadow-2xl relative font-sans space-y-4"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-3 text-indigo-400">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Icons.Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-white flex items-center space-x-2">
                  <span>Smart AI Auto-Categorization</span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-[10px] border border-indigo-500/30">
                    {selectedIncidents.length} Tickets Analyzed
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Telemetry pattern recognition & category classification engine
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <Icons.X className="h-4 w-4" />
            </button>
          </div>

          {/* Body Content */}
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 font-mono">
              <Icons.RefreshCw className="h-8 w-8 text-indigo-400 animate-spin" />
              <span className="text-xs text-slate-300">Analyzing telemetry logs, stack traces & root cause patterns...</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Proposed Operational Categories & Tags:</span>
                <button
                  onClick={() => setSelectedIds(selectedIds.length === selectedIncidents.length ? [] : selectedIncidents.map(i => i.id))}
                  className="text-indigo-400 hover:underline cursor-pointer text-[11px]"
                >
                  {selectedIds.length === selectedIncidents.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
                {selectedIncidents.map((inc) => {
                  const sugg = suggestions[inc.id];
                  const isChecked = selectedIds.includes(inc.id);

                  return (
                    <div
                      key={inc.id}
                      onClick={() => toggleSelectId(inc.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start space-x-3 ${
                        isChecked
                          ? 'bg-indigo-950/30 border-indigo-500/50 text-slate-100'
                          : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:bg-slate-900'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-1 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0 cursor-pointer"
                      />

                      <div className="flex-1 min-w-0 space-y-1.5 font-sans">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <div className="flex items-center space-x-2 font-mono text-xs">
                            <span className="font-bold text-indigo-400">{inc.id}</span>
                            <span className="text-slate-300 font-medium truncate max-w-xs">{inc.title}</span>
                          </div>

                          {sugg && (
                            <div className="flex items-center space-x-1 font-mono text-[10px]">
                              <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                {sugg.confidenceScore}% Match
                              </span>
                            </div>
                          )}
                        </div>

                        {sugg ? (
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                              <span className="text-xs font-bold text-indigo-300 font-mono bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 rounded-md">
                                🏷️ {sugg.primaryCategory}
                              </span>

                              {sugg.secondaryTags.map((tag) => (
                                <span key={tag} className="text-[10px] font-mono text-slate-300 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700">
                                  #{tag}
                                </span>
                              ))}
                            </div>

                            <p className="text-[11px] text-slate-400 leading-normal italic">
                              "{sugg.reasoning}"
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 italic">No suggestion calculated</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-800">
            <span className="text-xs font-mono text-slate-400">
              {selectedIds.length} of {selectedIncidents.length} items selected
            </span>

            <div className="flex space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold font-mono transition-colors cursor-pointer border border-slate-800"
              >
                Cancel
              </button>

              <button
                disabled={selectedIds.length === 0 || loading}
                onClick={handleApply}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold font-mono transition-all shadow-lg shadow-indigo-600/30 flex items-center space-x-1.5 cursor-pointer"
              >
                <Icons.CheckCircle2 className="h-3.5 w-3.5" />
                <span>Apply Auto-Categorization ({selectedIds.length})</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default SmartAutoCategorizationModal;

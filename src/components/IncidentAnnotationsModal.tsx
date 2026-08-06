import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';
import { Incident } from '../types';

export interface IncidentAnnotation {
  id: string;
  incidentId: string;
  author: string;
  authorRole: string;
  avatarColor: string;
  text: string;
  createdAt: string;
}

interface IncidentAnnotationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: Incident | null;
  onAddAuditLog?: (user: string, action: string, area: string, status: 'SUCCESS' | 'FAILED' | 'PENDING_APPROVAL', details: string) => void;
}

export function IncidentAnnotationsModal({
  isOpen,
  onClose,
  incident,
  onAddAuditLog
}: IncidentAnnotationsModalProps) {
  const [annotations, setAnnotations] = useState<IncidentAnnotation[]>([]);
  const [newText, setNewText] = useState('');
  const [authorName, setAuthorName] = useState('Eshan Barua (CTO)');

  useEffect(() => {
    if (!incident) return;

    // Load from localStorage
    try {
      const stored = localStorage.getItem('supportpilot_collaborative_annotations');
      if (stored) {
        const parsed: Record<string, IncidentAnnotation[]> = JSON.parse(stored);
        if (parsed[incident.id]) {
          setAnnotations(parsed[incident.id]);
          return;
        }
      }
    } catch (e) {
      console.error("Failed to load annotations from localStorage", e);
    }

    // Default seed annotations for collaborative context if none exist
    const defaultSeed: IncidentAnnotation[] = [
      {
        id: `ann-seed-1-${incident.id}`,
        incidentId: incident.id,
        author: 'Sarah Chen',
        authorRole: 'L2 Lead Engineer',
        avatarColor: 'bg-emerald-500',
        text: `Inspected stack trace for ${incident.id}. Root cause correlates with high thread lock contention on ${incident.appName}.`,
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: `ann-seed-2-${incident.id}`,
        incidentId: incident.id,
        author: 'Alex Rivera',
        authorRole: 'DevOps Specialist',
        avatarColor: 'bg-indigo-500',
        text: `Auto-remediation playbook was initiated. Scaled replica count to mitigate load spike.`,
        createdAt: new Date(Date.now() - 3600000).toISOString()
      }
    ];

    setAnnotations(defaultSeed);
  }, [incident]);

  if (!isOpen || !incident) return null;

  const handlePostAnnotation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;

    const newAnnotation: IncidentAnnotation = {
      id: `ann-${Date.now()}`,
      incidentId: incident.id,
      author: authorName,
      authorRole: 'Incident Commander',
      avatarColor: 'bg-cyan-500',
      text: newText.trim(),
      createdAt: new Date().toISOString()
    };

    const updated = [newAnnotation, ...annotations];
    setAnnotations(updated);
    setNewText('');

    // Save to localStorage
    try {
      const stored = localStorage.getItem('supportpilot_collaborative_annotations');
      const parsed: Record<string, IncidentAnnotation[]> = stored ? JSON.parse(stored) : {};
      parsed[incident.id] = updated;
      localStorage.setItem('supportpilot_collaborative_annotations', JSON.stringify(parsed));
    } catch (e) {
      console.error("Failed to save annotations", e);
    }

    if (onAddAuditLog) {
      onAddAuditLog(
        authorName,
        'Collaborative Annotation Added',
        'IncidentWorkspace',
        'SUCCESS',
        `Added annotation to ${incident.id}: "${newAnnotation.text.substring(0, 40)}..."`
      );
    }

    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message: `💬 Added collaborative annotation to ${incident.id}` }
    }));
  };

  const handleDeleteAnnotation = (id: string) => {
    const updated = annotations.filter(a => a.id !== id);
    setAnnotations(updated);

    try {
      const stored = localStorage.getItem('supportpilot_collaborative_annotations');
      const parsed: Record<string, IncidentAnnotation[]> = stored ? JSON.parse(stored) : {};
      parsed[incident.id] = updated;
      localStorage.setItem('supportpilot_collaborative_annotations', JSON.stringify(parsed));
    } catch (e) {}
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-2xl rounded-2xl border border-cyan-500/40 bg-slate-950 p-6 shadow-2xl relative font-sans space-y-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-3 text-cyan-400">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
                <Icons.MessageSquare className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-white flex items-center space-x-2">
                  <span>Collaborative Incident Annotations</span>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[10px] border border-cyan-500/30">
                    {incident.id}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Persistent team context & investigation notes
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

          {/* Incident Context Banner */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs font-mono">
            <div className="truncate pr-2">
              <span className="text-slate-400 font-bold">Ticket Title: </span>
              <span className="text-white font-sans font-medium">{incident.title}</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-indigo-300 shrink-0">
              {incident.appName}
            </span>
          </div>

          {/* New Annotation Input Form */}
          <form onSubmit={handlePostAnnotation} className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <label htmlFor="input-author" className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Author Identity</label>
              <input
                id="input-author"
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-[11px] text-cyan-300 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="relative">
              <textarea
                rows={3}
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Leave context, stack trace analysis, or escalation notes for the team..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none font-sans"
              />
              <button
                type="submit"
                disabled={!newText.trim()}
                className="absolute bottom-3 right-3 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold font-mono transition-all flex items-center space-x-1 cursor-pointer shadow-md shadow-cyan-600/30"
              >
                <Icons.Send className="h-3 w-3" />
                <span>Post Note</span>
              </button>
            </div>
          </form>

          {/* Annotation Feed List */}
          <div className="space-y-2 pt-2">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
              Annotation Thread History ({annotations.length})
            </span>

            <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1 font-sans">
              {annotations.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-slate-500">
                  No collaborative notes added yet. Be the first engineer to leave context!
                </div>
              ) : (
                annotations.map((ann) => (
                  <div key={ann.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5 relative group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`h-6 w-6 rounded-full ${ann.avatarColor || 'bg-cyan-500'} flex items-center justify-center font-mono font-bold text-[10px] text-white shrink-0`}>
                          {ann.author.charAt(0)}
                        </div>
                        <span className="text-xs font-bold text-slate-200">{ann.author}</span>
                        <span className="text-[10px] font-mono text-slate-500">({ann.authorRole})</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono text-slate-500">
                          {new Date(ann.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          onClick={() => handleDeleteAnnotation(ann.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition-opacity p-1 cursor-pointer"
                          title="Delete Annotation"
                        >
                          <Icons.Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed pl-8 font-sans">
                      {ann.text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 text-right">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold font-mono transition-colors cursor-pointer border border-slate-800"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default IncidentAnnotationsModal;

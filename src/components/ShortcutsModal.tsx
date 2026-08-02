import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as Icons from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab?: string;
}

export interface WorkflowKeymap {
  escalate: string;
  acknowledge: string;
  resolve: string;
  snooze: string;
  correlated_logs: string;
}

export const DEFAULT_WORKFLOW_KEYMAP: WorkflowKeymap = {
  escalate: 'E',
  acknowledge: 'A',
  resolve: 'R',
  snooze: 'S',
  correlated_logs: 'L',
};

export default function ShortcutsModal({ isOpen, onClose, activeTab }: ShortcutsModalProps) {
  const [workflowKeymap, setWorkflowKeymap] = useState<WorkflowKeymap>(() => {
    try {
      const saved = localStorage.getItem('supportpilot_workflow_keymap');
      return saved ? JSON.parse(saved) : DEFAULT_WORKFLOW_KEYMAP;
    } catch (e) {
      return DEFAULT_WORKFLOW_KEYMAP;
    }
  });

  const [editingKey, setEditingKey] = useState<keyof WorkflowKeymap | null>(null);

  const handleInnerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const saveKeymap = (newKeymap: WorkflowKeymap) => {
    setWorkflowKeymap(newKeymap);
    try {
      localStorage.setItem('supportpilot_workflow_keymap', JSON.stringify(newKeymap));
      window.dispatchEvent(new CustomEvent('workflow-keymap-updated', { detail: newKeymap }));
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: 'Updated Incident Workspace workflow keybindings!' }
      }));
    } catch (e) {
      console.error('Failed to save keymap:', e);
    }
  };

  const handleResetDefaults = () => {
    saveKeymap(DEFAULT_WORKFLOW_KEYMAP);
  };

  const handleKeyRebind = (actionKey: keyof WorkflowKeymap, newKeyRaw: string) => {
    const keyUpper = newKeyRaw.trim().toUpperCase();
    if (!keyUpper) return;
    const nextKey = keyUpper.slice(-1); // Take single character
    const updated = { ...workflowKeymap, [actionKey]: nextKey };
    saveKeymap(updated);
    setEditingKey(null);
  };

  const getTabSpecificShortcuts = (tab?: string) => {
    if (!tab) return null;
    switch (tab) {
      case 'workspace':
        return {
          title: "Active Context: Incident Workspace",
          icon: Icons.Terminal,
          shortcuts: [
            { keys: ["Alt", "P"], desc: "Toggle incident priority filter (High/Critical only)" },
            { keys: ["Alt", "N"], desc: "Instantiate a new manual incident ticket card" },
            { keys: ["Alt", "I"], desc: "Refocus active queue and workspace view" },
          ]
        };
      case 'aspnet':
        return {
          title: "Active Context: C# ASP.NET Core Engine",
          icon: Icons.Server,
          shortcuts: [
            { keys: ["Alt", "R"], desc: "Broadcast live SignalR diagnostic ping to subagents" },
            { keys: ["Alt", "W"], desc: "Reset active thread locks and diagnostic counts" },
          ]
        };
      case 'audit':
        return {
          title: "Active Context: Audit & Index",
          icon: Icons.Shield,
          shortcuts: [
            { keys: ["Alt", "U"], desc: "Manual secure audit log entry creation" },
          ]
        };
      case 'metrics':
        return {
          title: "Active Context: NOC & SLA Dashboard",
          icon: Icons.Zap,
          shortcuts: [
            { keys: ["Alt", "M"], desc: "Trigger SLA metrics database counter synchronization" },
          ]
        };
      default:
        return null;
    }
  };

  const tabGroup = getTabSpecificShortcuts(activeTab);

  const baseShortcutGroups = [
    {
      title: "Navigation & Layout",
      icon: Icons.Navigation,
      shortcuts: [
        { keys: ["Alt", "W"], desc: "Switch to ASP.NET Core Engine Tab" },
        { keys: ["Alt", "K"], desc: "Open Knowledge Base (Runbooks)" },
        { keys: ["Alt", "A"], desc: "Go to Active Agents console" },
        { keys: ["Alt", "M"], desc: "Show Performance Metrics and Health" },
        { keys: ["Alt", "D"], desc: "Toggle Sidebar Expanded / Pinned" },
        { keys: ["Alt", "F"], desc: "Focus Unified Full-Text Search" },
      ]
    },
    {
      title: "Interactive Actions",
      icon: Icons.Terminal,
      shortcuts: [
        { keys: ["Alt", "S"], desc: "Toggle System Simulator Control Console" },
        { keys: ["Alt", "R"], desc: "Trigger Real-time DB Re-Sync / Ping" },
        { keys: ["Alt", "U"], desc: "Seed Security Audit Trail Logs" },
        { keys: ["Esc"], desc: "Close active popups, modals, or terminals" },
      ]
    },
    {
      title: "System & Accessibility",
      icon: Icons.Accessibility,
      shortcuts: [
        { keys: ["?"], desc: "Toggle Keyboard Shortcuts modal (this view)" },
        { keys: ["Shift", "Tab"], desc: "Navigate interactive interactive panels focus" },
        { keys: ["Alt", "H"], desc: "Trigger Live health monitor diagnostics reset" },
      ]
    }
  ];

  const shortcutGroups = tabGroup ? [tabGroup, ...baseShortcutGroups] : baseShortcutGroups;

  const WORKFLOW_ITEMS: Array<{ id: keyof WorkflowKeymap; label: string; desc: string; icon: any; color: string }> = [
    { id: 'escalate', label: 'One-Click Escalation', desc: 'Set CRITICAL, assign NOC Lead, dispatch PagerDuty/Slack', icon: Icons.Zap, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
    { id: 'acknowledge', label: 'Acknowledge Triage', desc: 'Set status to INVESTIGATING and assign active engineer', icon: Icons.UserCheck, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' },
    { id: 'resolve', label: 'Quick Resolution', desc: 'Open Quick Resolve wizard or set status to SOLVED', icon: Icons.CheckCircle2, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
    { id: 'snooze', label: 'Snooze Incident', desc: 'Snooze active/selected incident for 1 hour', icon: Icons.Clock, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
    { id: 'correlated_logs', label: 'View Correlated Logs', desc: 'Open modal with 5-min log stream for active app/tag', icon: Icons.FileText, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          id="shortcuts-modal-overlay"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', stiffness: 350, damping: 26 }}
            onClick={handleInnerClick}
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl text-xs font-sans"
            id="shortcuts-modal-content"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-5 py-4">
              <div className="flex items-center space-x-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Icons.Keyboard className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-display font-bold text-white leading-tight">Keyboard Shortcuts & Workflow Keymapping</h3>
                  <p className="text-[10px] text-slate-400 leading-normal">Interactive console HUD controls & custom incident workspace keybindings</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <Icons.X className="h-4 w-4" />
              </button>
            </div>

            {/* Content Groups */}
            <div className="p-5 space-y-6 max-h-[75vh] overflow-y-auto">
              
              {/* WORKFLOW SHORTCUTS SECTION */}
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4 space-y-3 shadow-inner">
                <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <div className="p-1 rounded bg-indigo-500/20 text-indigo-300">
                      <Icons.Workflow className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-display font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                        <span>Workflow Shortcuts (Incident Workspace)</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Customizable</span>
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono">
                        Direct single-key actions when viewing incidents (E = Escalate, A = Acknowledge, R = Resolve, etc.)
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleResetDefaults}
                    className="text-[9.5px] font-mono text-indigo-300 hover:text-white hover:underline flex items-center space-x-1 bg-indigo-900/40 hover:bg-indigo-900/70 px-2 py-1 rounded border border-indigo-500/30 transition-all cursor-pointer"
                    title="Reset workflow keybindings back to default E, A, R, S, L"
                  >
                    <Icons.RotateCcw className="h-3 w-3" />
                    <span>Reset Defaults</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {WORKFLOW_ITEMS.map((item) => {
                    const ItemIcon = item.icon;
                    const mappedKey = workflowKeymap[item.id] || DEFAULT_WORKFLOW_KEYMAP[item.id];
                    const isEditing = editingKey === item.id;

                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 hover:bg-slate-950/90 transition-colors"
                      >
                        <div className="flex items-start space-x-2 min-w-0 pr-2">
                          <div className={`p-1.5 rounded-lg border shrink-0 ${item.color}`}>
                            <ItemIcon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold text-white leading-tight truncate">{item.label}</div>
                            <div className="text-[9.5px] text-slate-400 font-sans leading-tight mt-0.5 line-clamp-1">{item.desc}</div>
                          </div>
                        </div>

                        {/* Interactive Key Binding Badge / Rebind Input */}
                        <div className="shrink-0 font-mono">
                          {isEditing ? (
                            <input
                              type="text"
                              maxLength={1}
                              autoFocus
                              placeholder={mappedKey}
                              defaultValue={mappedKey}
                              onBlur={(e) => handleKeyRebind(item.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleKeyRebind(item.id, e.currentTarget.value);
                                } else if (e.key === 'Escape') {
                                  setEditingKey(null);
                                }
                              }}
                              className="w-8 h-7 text-center rounded border border-indigo-500 bg-indigo-950 text-amber-300 text-xs font-bold font-mono outline-none focus:ring-1 focus:ring-indigo-400 uppercase"
                            />
                          ) : (
                            <button
                              onClick={() => setEditingKey(item.id)}
                              className="group flex items-center space-x-1 rounded border border-indigo-500/40 bg-slate-900 hover:bg-indigo-600/30 hover:border-indigo-400 px-2 py-1 transition-all cursor-pointer"
                              title="Click to change shortcut key"
                            >
                              <kbd className="text-[10px] font-mono font-extrabold text-amber-300">
                                {mappedKey}
                              </kbd>
                              <Icons.Edit2 className="h-2.5 w-2.5 text-slate-500 group-hover:text-indigo-300 transition-colors" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Standard Shortcut Groups */}
              {shortcutGroups.map((group, groupIdx) => {
                const GroupIcon = group.icon;
                return (
                  <div key={groupIdx} className="space-y-2.5">
                    <h4 className="flex items-center space-x-2 text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400">
                      <GroupIcon className="h-3.5 w-3.5" />
                      <span>{group.title}</span>
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.shortcuts.map((shortcut, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/30 px-3 py-2 hover:bg-slate-950/65 transition-colors"
                        >
                          <span className="text-[11px] text-slate-300 font-medium">{shortcut.desc}</span>
                          <div className="flex items-center space-x-1 font-mono shrink-0 ml-2">
                            {shortcut.keys.map((key, keyIdx) => (
                              <React.Fragment key={keyIdx}>
                                {keyIdx > 0 && <span className="text-[9px] text-slate-500 px-0.5">+</span>}
                                <kbd className="inline-flex min-w-[20px] items-center justify-center rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
                                  {key}
                                </kbd>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Accessibility tips */}
            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/80 px-5 py-3.5 text-[10px] text-slate-400 font-mono">
              <span className="flex items-center space-x-1.5">
                <Icons.Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                <span>Tip: Press <kbd className="px-1 border border-slate-700 rounded text-white bg-slate-800">?</kbd> key anytime to show/hide</span>
              </span>
              <span className="text-slate-500">WCAG 2.1 COMPLIANT</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}


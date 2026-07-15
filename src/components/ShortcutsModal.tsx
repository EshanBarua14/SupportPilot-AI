import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as Icons from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab?: string;
}

export default function ShortcutsModal({ isOpen, onClose, activeTab }: ShortcutsModalProps) {
  // Prevent propagation for inner clicks
  const handleInnerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
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
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl text-xs font-sans"
            id="shortcuts-modal-content"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-5 py-4">
              <div className="flex items-center space-x-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Icons.Keyboard className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-display font-bold text-white leading-tight">Keyboard Shortcuts & Accessibility</h3>
                  <p className="text-[10px] text-slate-400 leading-normal">Interactive console HUD controls for SupportPilot AI system engineers</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                aria-label="Close modal"
              >
                <Icons.X className="h-4 w-4" />
              </button>
            </div>

            {/* Content Groups */}
            <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
              {shortcutGroups.map((group, groupIdx) => {
                const GroupIcon = group.icon;
                return (
                  <div key={groupIdx} className="space-y-2.5">
                    <h4 className="flex items-center space-x-2 text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400">
                      <GroupIcon className="h-3.5 w-3.5" />
                      <span>{group.title}</span>
                    </h4>
                    
                    <div className="grid grid-cols-1 gap-2">
                      {group.shortcuts.map((shortcut, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/30 px-3 py-2.5 hover:bg-slate-950/65 transition-colors"
                        >
                          <span className="text-[11px] text-slate-300 font-medium">{shortcut.desc}</span>
                          <div className="flex items-center space-x-1 font-mono">
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

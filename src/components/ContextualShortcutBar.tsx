import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSupportPilot, TabType } from '../context/SupportPilotContext';

interface ShortcutItem {
  keyCombo: string;
  label: string;
  action: () => void;
  icon?: any;
}

export const ContextualShortcutBar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    setIsCommandPaletteOpen,
    setIsShortcutsOpen,
    isPinned,
    setIsPinned,
    handleAddAuditLog
  } = useSupportPilot();

  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('supportpilot_shortcuts_bar_expanded');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const toggleExpanded = () => {
    setIsExpanded(prev => {
      const next = !prev;
      localStorage.setItem('supportpilot_shortcuts_bar_expanded', JSON.stringify(next));
      return next;
    });
  };

  // Keyboard shortcut listener for Cmd + / (or Ctrl + /) to toggle bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        toggleExpanded();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Build shortcuts depending on activeTab
  const getTabShortcuts = (): ShortcutItem[] => {
    const common: ShortcutItem[] = [
      {
        keyCombo: '⌘ K',
        label: 'Palette',
        action: () => setIsCommandPaletteOpen(true),
        icon: Icons.Search
      },
      {
        keyCombo: '⌘ /',
        label: isExpanded ? 'Hide Bar' : 'Shortcut Bar',
        action: toggleExpanded,
        icon: Icons.Keyboard
      }
    ];

    switch (activeTab) {
      case 'workspace':
        return [
          {
            keyCombo: 'Alt N',
            label: 'New Ticket',
            action: () => window.dispatchEvent(new CustomEvent('create-new-ticket')),
            icon: Icons.Plus
          },
          {
            keyCombo: 'Alt S',
            label: 'Snooze Bulk',
            action: () => window.dispatchEvent(new CustomEvent('trigger-snooze-bulk')),
            icon: Icons.Clock
          },
          {
            keyCombo: 'Alt C',
            label: 'Correlation Map',
            action: () => window.dispatchEvent(new CustomEvent('toggle-correlation-view')),
            icon: Icons.GitMerge
          },
          {
            keyCombo: 'Alt P',
            label: 'P0/P1 Filter',
            action: () => window.dispatchEvent(new CustomEvent('toggle-priority-filter')),
            icon: Icons.AlertOctagon
          },
          ...common
        ];

      case 'metrics':
        return [
          {
            keyCombo: 'Alt R',
            label: 'Refresh NOC',
            action: () => window.dispatchEvent(new CustomEvent('refresh-metrics')),
            icon: Icons.RefreshCw
          },
          {
            keyCombo: 'Alt E',
            label: 'Export Metrics',
            action: () => window.dispatchEvent(new CustomEvent('export-metrics-pdf')),
            icon: Icons.Download
          },
          {
            keyCombo: 'Alt 1',
            label: 'SLA Health',
            action: () => window.dispatchEvent(new CustomEvent('focus-sla-chart')),
            icon: Icons.Activity
          },
          ...common
        ];

      case 'audit':
        return [
          {
            keyCombo: 'Alt F',
            label: 'Filter Ledger',
            action: () => window.dispatchEvent(new CustomEvent('focus-audit-filter')),
            icon: Icons.Filter
          },
          {
            keyCombo: 'Alt E',
            label: 'Export CSV',
            action: () => window.dispatchEvent(new CustomEvent('export-audit-csv')),
            icon: Icons.FileSpreadsheet
          },
          {
            keyCombo: 'Alt U',
            label: 'Seed Event',
            action: () => window.dispatchEvent(new CustomEvent('seed-audit-event')),
            icon: Icons.PlusCircle
          },
          ...common
        ];

      case 'runbooks':
        return [
          {
            keyCombo: 'Alt N',
            label: 'New Runbook',
            action: () => window.dispatchEvent(new CustomEvent('create-new-runbook')),
            icon: Icons.BookOpen
          },
          {
            keyCombo: 'Alt /',
            label: 'Search KB',
            action: () => window.dispatchEvent(new CustomEvent('focus-runbook-search')),
            icon: Icons.Search
          },
          ...common
        ];

      case 'settings':
        return [
          {
            keyCombo: 'Alt 1',
            label: 'Voice Builder',
            action: () => window.dispatchEvent(new CustomEvent('switch-settings-tab', { detail: 'voice' })),
            icon: Icons.Mic
          },
          {
            keyCombo: 'Alt 2',
            label: 'Layout Presets',
            action: () => window.dispatchEvent(new CustomEvent('switch-settings-tab', { detail: 'layouts' })),
            icon: Icons.LayoutGrid
          },
          ...common
        ];

      default:
        return [
          {
            keyCombo: 'Alt W',
            label: 'Workspace',
            action: () => setActiveTab('workspace'),
            icon: Icons.Inbox
          },
          ...common
        ];
    }
  };

  const currentShortcuts = getTabShortcuts();

  return (
    <div className="fixed bottom-2.5 right-4 z-40 select-none font-mono">
      <AnimatePresence mode="wait">
        {isExpanded ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="flex items-center space-x-2 rounded-xl border border-indigo-500/30 bg-slate-950/95 px-3 py-1.5 shadow-xl shadow-black/80 backdrop-blur-xl"
          >
            {/* Active Tab Badge Indicator */}
            <div className="flex items-center space-x-1.5 border-r border-slate-800 pr-2.5 text-[9px] text-indigo-400 font-bold uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{activeTab.toUpperCase()}</span>
            </div>

            {/* Shortcut Pills */}
            <div className="flex items-center space-x-1.5">
              {currentShortcuts.map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={item.action}
                    className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-indigo-600/30 border border-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-white transition-all cursor-pointer group"
                    title={`Trigger ${item.label} (${item.keyCombo})`}
                  >
                    {IconComponent && <IconComponent className="h-3 w-3 text-indigo-400 group-hover:scale-110 transition-transform" />}
                    <span className="px-1 py-0.2 rounded bg-slate-950 border border-slate-800 text-[8.5px] font-bold text-amber-300">
                      {item.keyCombo}
                    </span>
                    <span className="text-[9.5px] font-sans font-semibold text-slate-300 group-hover:text-white">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Minimize Toggle */}
            <button
              onClick={toggleExpanded}
              className="p-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-1"
              title="Minimize Shortcut Overlay (⌘/)"
            >
              <Icons.ChevronDown className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={toggleExpanded}
            className="flex items-center space-x-2 rounded-xl border border-indigo-500/40 bg-slate-950/90 px-3 py-1.5 text-[10px] font-bold text-indigo-300 hover:text-white hover:border-indigo-500 shadow-xl backdrop-blur-md transition-all cursor-pointer group"
            title="Expand Contextual Keyboard Shortcuts (⌘/)"
          >
            <Icons.Keyboard className="h-3.5 w-3.5 text-indigo-400 group-hover:rotate-12 transition-transform" />
            <span className="uppercase tracking-wider">Shortcuts</span>
            <span className="px-1 py-0.2 rounded bg-slate-900 border border-slate-800 text-[8px] text-amber-300 font-mono">
              ⌘ /
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ContextualShortcutBar;

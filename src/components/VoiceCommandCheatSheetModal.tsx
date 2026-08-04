import React, { useState } from 'react';
import * as Icons from 'lucide-react';

interface VoiceCommandCheatSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTryPhrase?: (phrase: string) => void;
}

export const VOICE_SYNTAX_COMMANDS = [
  {
    category: 'Severity Filtering',
    icon: Icons.Filter,
    color: 'text-amber-400',
    commands: [
      { phrase: '"Show me critical" or "Sev-1"', description: 'Filter queue to P0 Critical Incidents' },
      { phrase: '"Sev-2" or "High incidents"', description: 'Filter queue to P1 High Severity Incidents' },
      { phrase: '"Sev-3" or "Medium incidents"', description: 'Filter queue to P2/P3 Moderate Incidents' },
      { phrase: '"Show all incidents" or "Clear filter"', description: 'Reset queue severity filters' }
    ]
  },
  {
    category: 'Status Updates & Escalation',
    icon: Icons.CheckCircle2,
    color: 'text-emerald-400',
    commands: [
      { phrase: '"Set status to investigating" or "Mark investigating"', description: 'Change active incident status to INVESTIGATING' },
      { phrase: '"Mark solved" or "Resolve incident"', description: 'Set active incident status to SOLVED' },
      { phrase: '"Escalate incident"', description: 'Set active incident status to ESCALATED and assign SRE tier 3' }
    ]
  },
  {
    category: 'Cognitive Investigation & AI',
    icon: Icons.Sparkles,
    color: 'text-purple-400',
    commands: [
      { phrase: '"Run investigation" or "Analyze incident"', description: 'Trigger Gemini AI Root Cause Telemetry Analysis' },
      { phrase: '"Dictate findings [spoken notes]"', description: 'Append transcribed voice findings to incident description' }
    ]
  }
];

export const VoiceCommandCheatSheetModal: React.FC<VoiceCommandCheatSheetModalProps> = ({
  isOpen,
  onClose,
  onTryPhrase
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn font-sans">
      <div className="w-full max-w-2xl rounded-2xl border border-indigo-500/40 bg-slate-900 p-6 shadow-2xl text-slate-100 relative overflow-hidden space-y-4">
        {/* Top Accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-cyan-400 to-purple-500" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Icons.Mic className="h-5 w-5 animate-pulse text-indigo-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-display">
                Voice Command Cheat Sheet & Syntax Guide
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Natural speech phrases supported by SupportPilot Browser Speech Transceiver
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close Cheat Sheet"
          >
            <Icons.X className="h-5 w-5" />
          </button>
        </div>

        {/* Syntax Categories Grid */}
        <div className="space-y-3.5 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
          {VOICE_SYNTAX_COMMANDS.map((cat, i) => {
            const Icon = cat.icon;
            return (
              <div key={i} className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-3.5 space-y-2">
                <div className="flex items-center space-x-2 border-b border-slate-800/60 pb-1.5">
                  <Icon className={`h-4 w-4 ${cat.color}`} />
                  <h4 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                    {cat.category}
                  </h4>
                </div>

                <div className="grid grid-cols-1 gap-2 pt-1">
                  {cat.commands.map((cmd, cIdx) => (
                    <div
                      key={cIdx}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition-all group"
                    >
                      <div className="space-y-0.5">
                        <span className="font-mono font-bold text-indigo-300 text-xs block">
                          {cmd.phrase}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {cmd.description}
                        </span>
                      </div>

                      {onTryPhrase && (
                        <button
                          onClick={() => {
                            onTryPhrase(cmd.phrase.replace(/"/g, ''));
                            onClose();
                          }}
                          className="px-2 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/60 border border-indigo-500/40 text-indigo-200 hover:text-white text-[9.5px] font-mono font-bold transition-all cursor-pointer shrink-0 flex items-center space-x-1"
                          title="Simulate speech for this command"
                        >
                          <Icons.Volume2 className="h-3 w-3 text-indigo-400" />
                          <span>Simulate</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info & Wake-phrase hint */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center space-x-2 text-[10px]">
            <Icons.Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
            <span>Speech Recognition Engine: <strong className="text-white">WebSpeech API (en-US)</strong></span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all text-xs cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceCommandCheatSheetModal;

import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';

export interface VoiceCommandItem {
  id: string;
  timestamp: string;
  rawText: string;
  commandName: string;
  param?: string;
  status: 'SUCCESS' | 'EXECUTING' | 'FAILED';
}

interface VoiceCommandHistoryPanelProps {
  onReplayCommand?: (cmd: string, param?: string) => void;
}

export const VoiceCommandHistoryPanel: React.FC<VoiceCommandHistoryPanelProps> = ({ onReplayCommand }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [commands, setCommands] = useState<VoiceCommandItem[]>([
    {
      id: 'cmd-1',
      timestamp: '10:41 AM',
      rawText: 'Set incident status to investigating',
      commandName: 'SET_STATUS',
      param: 'INVESTIGATING',
      status: 'SUCCESS'
    },
    {
      id: 'cmd-2',
      timestamp: '10:45 AM',
      rawText: 'Run AI incident investigation analysis',
      commandName: 'RUN_INVESTIGATION',
      status: 'SUCCESS'
    },
    {
      id: 'cmd-3',
      timestamp: '10:50 AM',
      rawText: 'Escalate incident to tier 3 SRE on-call',
      commandName: 'SET_STATUS',
      param: 'ESCALATED',
      status: 'SUCCESS'
    }
  ]);

  useEffect(() => {
    const handleVoiceEvent = (e: CustomEvent<VoiceCommandItem>) => {
      if (e.detail) {
        setCommands(prev => [e.detail, ...prev]);
        setIsOpen(true); // Auto expand on new voice command
      }
    };

    window.addEventListener('voice-command-processed' as any, handleVoiceEvent);
    return () => {
      window.removeEventListener('voice-command-processed' as any, handleVoiceEvent);
    };
  }, []);

  const handleReplay = (item: VoiceCommandItem) => {
    if (onReplayCommand) {
      onReplayCommand(item.commandName, item.param);
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: `Re-executed voice command: ${item.commandName} ${item.param || ''}` }
      }));
    }
  };

  const clearHistory = () => {
    setCommands([]);
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xl border border-indigo-400/40 flex items-center space-x-2 transition-all transform hover:scale-105 cursor-pointer font-mono text-xs"
        title="Voice Command Processing History"
      >
        <Icons.Mic className="h-5 w-5 animate-pulse text-indigo-200" />
        <span className="hidden sm:inline font-bold">Voice Commands ({commands.length})</span>
        {commands.length > 0 && (
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
        )}
      </button>

      {/* Floating Side-Panel Drawer */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-80 md:w-96 bg-slate-950/95 border-l border-slate-800/80 shadow-2xl p-4 flex flex-col font-mono backdrop-blur-md transition-all">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                <Icons.History className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-bold text-xs text-white uppercase tracking-wider">
                  Voice Command History
                </h3>
                <p className="text-[9px] text-slate-400">Processed speech-to-text telemetry actions</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {commands.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-slate-500 hover:text-rose-400 text-xxs transition-colors"
                  title="Clear history"
                >
                  <Icons.Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <Icons.X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Commands List */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {commands.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs font-mono space-y-2">
                <Icons.MicOff className="h-8 w-8 text-slate-600 mx-auto" />
                <p>No voice commands logged yet.</p>
                <p className="text-[9.5px] text-slate-600">Use the Voice-to-Text button in the workspace to dictate commands.</p>
              </div>
            ) : (
              commands.map(item => (
                <div
                  key={item.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 space-y-1.5 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between text-[9.5px]">
                    <div className="flex items-center space-x-1.5 font-bold">
                      <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[8.5px]">
                        {item.commandName}
                      </span>
                      {item.param && (
                        <span className="text-amber-400">
                          [{item.param}]
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1.5 text-slate-400">
                      <span>{item.timestamp}</span>
                      <span className={`px-1 rounded text-[8px] font-bold ${
                        item.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs font-sans text-slate-300 italic bg-slate-950 p-2 rounded border border-slate-800/60 leading-snug">
                    "{item.rawText}"
                  </p>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => handleReplay(item)}
                      className="text-xxs font-mono text-indigo-400 hover:text-indigo-300 font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <Icons.RotateCw className="h-3 w-3" />
                      <span>Re-Execute Command</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
};

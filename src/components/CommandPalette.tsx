import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { CommandList } from '../data/simulation';
import { Search, Terminal, Zap, Shield, HelpCircle, X, FileText, Activity, ArrowRight, Loader2, Mic, MicOff } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteCommand: (commandName: string) => void;
  onNavigate: (tabId: string) => void;
}

interface SearchResultItem {
  type: 'INCIDENT' | 'RUNBOOK' | 'AUDIT_LOG';
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

export default function CommandPalette({ isOpen, onClose, onExecuteCommand, onNavigate }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [backendResults, setBackendResults] = useState<{
    incidents: SearchResultItem[];
    runbooks: SearchResultItem[];
    auditLogs: SearchResultItem[];
  }>({ incidents: [], runbooks: [], auditLogs: [] });

  // Voice Microphone API State
  const [isListening, setIsListening] = useState(false);
  const [micTranscript, setMicTranscript] = useState('');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const paletteRef = useRef<HTMLDivElement>(null);

  // Initialize Speech Recognition when listening is toggled
  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setSpeechError("Speech recognition is not supported in this browser.");
      setTimeout(() => setSpeechError(null), 3000);
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        if (currentTranscript) {
          setSearch(currentTranscript);
          setMicTranscript(currentTranscript);
          setSelectedIndex(0);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech Recognition error in Command Palette:', event.error);
        if (event.error !== 'no-speech') {
          setSpeechError(`Voice input: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Error starting Speech Recognition:', err);
      setSpeechError("Microphone permission denied or unavailable.");
      setIsListening(false);
    }
  };

  // Cleanup speech recognition on unmount or close
  useEffect(() => {
    if (!isOpen && isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsListening(false);
    }
  }, [isOpen, isListening]);

  // Close command palette on escape or shortcut press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Fetch backend search results on search query change (debounced)
  useEffect(() => {
    if (!search.trim()) {
      setBackendResults({ incidents: [], runbooks: [], auditLogs: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/aspnet/search?q=${encodeURIComponent(search)}`);
        if (response.ok) {
          const data = await response.json();
          setBackendResults(data);
        }
      } catch (err) {
        console.error("Backend fuzzy search stream disconnected.", err);
      } finally {
        setIsSearching(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [search]);

  const navigationItems = [
    { name: "Support Workspace & Incident Response", id: "workspace", icon: Terminal, desc: "Manage L1/L2/L3 active incident queues" },
    { name: "Orchestration & AI Agent Matrix", id: "agents", icon: Shield, desc: "Configure and chat with 19 autonomous sub-agents" },
    { name: "NOC Telemetry & Analytics Dashboard", id: "metrics", icon: Zap, desc: "Real-time SLA burn rates, CSAT trackers, and metrics" },
    { name: "Enterprise Knowledge Base & Runbooks", id: "runbooks", icon: HelpCircle, desc: "Search and synthesize AI-curated Markdown articles" },
    { name: "System Settings & Model Swapper", id: "settings", icon: HelpCircle, desc: "Adjust Gemini model targets and API policies" },
    { name: "Immutable Audit Log & Master Index", id: "audit", icon: Shield, desc: "Review compliance trails and live project index" }
  ];

  const filteredCommands = CommandList.filter(cmd => 
    cmd.name.toLowerCase().includes(search.toLowerCase()) || 
    cmd.desc.toLowerCase().includes(search.toLowerCase())
  );

  const filteredNav = navigationItems.filter(nav => 
    nav.name.toLowerCase().includes(search.toLowerCase()) || 
    nav.desc.toLowerCase().includes(search.toLowerCase())
  );

  // Flat list compilation for keyboard indexing and arrow key navigation
  const allItems: Array<{
    flatType: 'NAV' | 'CMD' | 'INCIDENT' | 'RUNBOOK' | 'AUDIT_LOG';
    id: string;
    name: string;
    desc: string;
    icon?: any;
    subtitle?: string;
  }> = [
    ...filteredNav.map(n => ({ flatType: 'NAV' as const, id: n.id, name: n.name, desc: n.desc, icon: n.icon })),
    ...filteredCommands.map(c => ({ flatType: 'CMD' as const, id: c.name, name: c.name, desc: c.desc })),
    ...backendResults.incidents.map(i => ({ flatType: 'INCIDENT' as const, id: i.id, name: i.title, desc: i.subtitle })),
    ...backendResults.runbooks.map(r => ({ flatType: 'RUNBOOK' as const, id: r.id, name: r.title, desc: r.subtitle })),
    ...backendResults.auditLogs.map(a => ({ flatType: 'AUDIT_LOG' as const, id: a.id, name: a.title, desc: a.subtitle }))
  ];

  const totalItems = allItems.length;

  const handleSelectItemIndex = (index: number) => {
    const item = allItems[index];
    if (!item) return;

    if (item.flatType === 'NAV') {
      onNavigate(item.id);
    } else if (item.flatType === 'CMD') {
      onExecuteCommand(item.id);
    } else if (item.flatType === 'INCIDENT') {
      onNavigate('workspace');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('select-incident', { detail: { incidentId: item.id } }));
      }, 100);
    } else if (item.flatType === 'RUNBOOK') {
      onNavigate('runbooks');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('select-runbook', { detail: { runbookId: item.id } }));
      }, 100);
    } else if (item.flatType === 'AUDIT_LOG') {
      onNavigate('audit');
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelectItemIndex(selectedIndex);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/70 pt-[10vh] backdrop-blur-sm">
      <div 
        ref={paletteRef}
        onKeyDown={handleKeyDown}
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-800 bg-slate-900/95 shadow-2xl glow-indigo"
      >
        {/* Header Search Field */}
        <div className="flex items-center border-b border-slate-800 px-4 py-3 gap-2">
          <Search className="h-5 w-5 text-slate-400 shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder={isListening ? "Listening to voice input... speak command" : "Search panels, incidents, runbooks, audits... (e.g., k8s)"}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            className="flex-1 bg-transparent py-1 font-sans text-sm text-white placeholder-slate-500 outline-none"
          />
          {isSearching && <Loader2 className="h-4 w-4 text-indigo-400 animate-spin shrink-0" />}

          {/* Browser Microphone API Integration Button */}
          <button
            type="button"
            onClick={toggleListening}
            className={`flex items-center space-x-1.5 rounded-lg px-2.5 py-1.5 text-xs font-mono font-semibold transition-all cursor-pointer ${
              isListening
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 animate-pulse shadow-md shadow-rose-500/20'
                : 'bg-slate-800/80 text-slate-300 hover:bg-indigo-600/20 hover:text-indigo-300 border border-slate-700'
            }`}
            title={isListening ? "Stop voice listening" : "Trigger commands via browser Microphone Voice Input"}
          >
            {isListening ? (
              <>
                <Mic className="h-3.5 w-3.5 text-rose-400 animate-bounce" />
                <span className="text-[10px] uppercase font-bold tracking-wider">Listening</span>
              </>
            ) : (
              <>
                <Mic className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-[10px] hidden sm:inline">Voice</span>
              </>
            )}
          </button>

          <button 
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Voice Input Banner Alerts */}
        {isListening && (
          <div className="bg-rose-950/40 border-b border-rose-500/30 px-4 py-1.5 flex items-center justify-between text-xxs font-mono text-rose-300">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <span>Microphone Active: Speak your search query or command...</span>
            </div>
            {micTranscript && (
              <span className="text-slate-400 truncate max-w-[200px]">
                "{micTranscript}"
              </span>
            )}
          </div>
        )}

        {speechError && (
          <div className="bg-amber-950/40 border-b border-amber-500/30 px-4 py-1.5 text-xxs font-mono text-amber-300 flex items-center space-x-2">
            <MicOff className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>{speechError}</span>
          </div>
        )}

        {/* Dynamic List */}
        <div className="max-h-96 overflow-y-auto p-2 font-sans text-xs">
          
          {/* 1. Navigation Panel */}
          {filteredNav.length > 0 && (
            <div className="mb-2.5">
              <div className="px-3 py-1 font-display font-medium text-indigo-400 tracking-wider text-[10px]">NAVIGATE WORKSPACE</div>
              {filteredNav.map((item) => {
                const globalIndex = allItems.findIndex(x => x.flatType === 'NAV' && x.id === item.id);
                const isSelected = globalIndex === selectedIndex;
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectItemIndex(globalIndex)}
                    className={`flex cursor-pointer items-center rounded-lg px-3 py-2 transition-colors ${
                      isSelected ? 'bg-indigo-600/40 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className="mr-3 h-4 w-4 text-indigo-400" />
                    <div className="flex-1">
                      <div className="font-medium text-xs">{item.name}</div>
                      <div className="text-slate-400 text-[10px] mt-0.5">{item.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 2. Live Matching Incidents */}
          {backendResults.incidents.length > 0 && (
            <div className="mb-2.5">
              <div className="px-3 py-1 font-display font-medium text-rose-400 tracking-wider text-[10px]">MATCHED OPERATIONAL INCIDENTS</div>
              {backendResults.incidents.map((item, idx) => {
                const globalIndex = allItems.findIndex(x => x.flatType === 'INCIDENT' && x.id === item.id);
                const isSelected = globalIndex === selectedIndex;
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.94, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
                    onClick={() => handleSelectItemIndex(globalIndex)}
                    className={`flex cursor-pointer items-center rounded-lg px-3 py-2 transition-colors ${
                      isSelected ? 'bg-rose-500/20 text-white font-semibold border-l-2 border-rose-500' : 'text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <Activity className="mr-3 h-4 w-4 text-rose-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs truncate">{item.title}</div>
                      <div className="text-slate-400 text-[10px] mt-0.5 truncate">{item.subtitle}</div>
                    </div>
                    <ArrowRight className="h-3 w-3 text-rose-400 ml-2" />
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* 3. Live Matching KB Articles/Runbooks */}
          {backendResults.runbooks.length > 0 && (
            <div className="mb-2.5">
              <div className="px-3 py-1 font-display font-medium text-indigo-300 tracking-wider text-[10px]">MATCHED KNOWLEDGE ARTICLES</div>
              {backendResults.runbooks.map((item) => {
                const globalIndex = allItems.findIndex(x => x.flatType === 'RUNBOOK' && x.id === item.id);
                const isSelected = globalIndex === selectedIndex;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectItemIndex(globalIndex)}
                    className={`flex cursor-pointer items-center rounded-lg px-3 py-2 transition-colors ${
                      isSelected ? 'bg-indigo-600/20 text-white font-semibold border-l-2 border-indigo-400' : 'text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <FileText className="mr-3 h-4 w-4 text-indigo-300 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs truncate">{item.title}</div>
                      <div className="text-slate-400 text-[10px] mt-0.5 truncate">{item.subtitle}</div>
                    </div>
                    <ArrowRight className="h-3 w-3 text-indigo-300 ml-2" />
                  </div>
                );
              })}
            </div>
          )}

          {/* 4. Live Matching Audit Trails */}
          {backendResults.auditLogs.length > 0 && (
            <div className="mb-2.5">
              <div className="px-3 py-1 font-display font-medium text-amber-400 tracking-wider text-[10px]">MATCHED COMPLIANCE AUDIT TRAILS</div>
              {backendResults.auditLogs.map((item) => {
                const globalIndex = allItems.findIndex(x => x.flatType === 'AUDIT_LOG' && x.id === item.id);
                const isSelected = globalIndex === selectedIndex;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectItemIndex(globalIndex)}
                    className={`flex cursor-pointer items-center rounded-lg px-3 py-2 transition-colors ${
                      isSelected ? 'bg-amber-500/10 text-white font-semibold border-l-2 border-amber-400' : 'text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <Shield className="mr-3 h-4 w-4 text-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs truncate">{item.title}</div>
                      <div className="text-slate-400 text-[10px] mt-0.5 truncate">{item.subtitle}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 5. Automation Commands */}
          {filteredCommands.length > 0 && (
            <div>
              <div className="px-3 py-1 font-display font-medium text-emerald-400 tracking-wider text-[10px]">AUTOMATION SCRIPTS (/COMMANDS)</div>
              {filteredCommands.map((item) => {
                const globalIndex = allItems.findIndex(x => x.flatType === 'CMD' && x.id === item.name);
                const isSelected = globalIndex === selectedIndex;
                return (
                  <div
                    key={item.name}
                    onClick={() => handleSelectItemIndex(globalIndex)}
                    className={`flex cursor-pointer items-center rounded-lg px-3 py-2 transition-colors ${
                      isSelected ? 'bg-emerald-600/40 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <Terminal className="mr-3 h-4 w-4 text-emerald-400" />
                    <div className="flex-1">
                      <div className="font-mono font-semibold text-xs text-emerald-300">{item.name}</div>
                      <div className="text-slate-400 text-[10px] mt-0.5">{item.desc}</div>
                    </div>
                    <div className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] text-emerald-400">
                      SYS_EXEC
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalItems === 0 && (
            <div className="py-8 text-center text-slate-500">
              No matching records, panels, or automation commands found. Try typing a specific keyword like "k8s" or "database".
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/80 px-4 py-2 font-mono text-[9px] text-slate-500">
          <div className="flex items-center space-x-4">
            <span><kbd className="rounded bg-slate-800 px-1 py-0.5">↑↓</kbd> Navigate</span>
            <span><kbd className="rounded bg-slate-800 px-1 py-0.5">Enter</kbd> Select</span>
            <span><kbd className="rounded bg-slate-800 px-1 py-0.5">Esc</kbd> Close</span>
          </div>
          <div>
            <span>SupportPilot AI Command Engine</span>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { SupportAgent } from '../types';
import { SeedAgents } from '../data/simulation';
import * as Icons from 'lucide-react';

interface AgentOrchestratorProps {
  modelSelection: string;
}

const getAgentOperatingMode = (id: string) => {
  if (id.includes('support')) {
    return {
      mode: 'Analyzing' as const,
      color: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
      glow: 'bg-indigo-400',
      guidance: 'Evaluating incoming telemetry logs for pattern matching and early failure classification.'
    };
  } else if (id.includes('incident') || id.includes('db')) {
    return {
      mode: 'Remediating' as const,
      color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
      glow: 'bg-emerald-400',
      guidance: 'Executing connection pool recycle and active remediation protocols on relational clusters.'
    };
  } else {
    return {
      mode: 'Escalating' as const,
      color: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
      glow: 'bg-rose-400',
      guidance: 'Compiling high-severity diagnostic digest and preparing immediate escalations to L3 operators.'
    };
  }
};

export default function AgentOrchestrator({ modelSelection }: AgentOrchestratorProps) {
  const [agents, setAgents] = useState<SupportAgent[]>(SeedAgents);
  const [selectedAgent, setSelectedAgent] = useState<SupportAgent>(SeedAgents[0]);
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'agent', text: string, reasoning?: string }>>([]);
  const [userInput, setUserInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // For Prompt tuning
  const [tuningInstruction, setTuningInstruction] = useState(selectedAgent.systemInstruction);
  const [showTuningSaved, setShowTuningSaved] = useState(false);

  const selectAgent = (agent: SupportAgent) => {
    setSelectedAgent(agent);
    setTuningInstruction(agent.systemInstruction);
    setChatHistory([
      { 
        role: 'agent', 
        text: `Hello! I am ${agent.name}, your automated ${agent.role}. I have access to tools like ${agent.tools.join(', ')}. How can I assist you with infrastructure diagnostics today?` 
      }
    ]);
    setErrorMessage(null);
  };

  const getAgentIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName];
    return IconComponent ? <IconComponent className="h-5 w-5" /> : <Icons.Bot className="h-5 w-5" />;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isSending) return;

    const messageToSend = userInput;
    const nextHistory = [...chatHistory, { role: 'user' as const, text: messageToSend }];
    setChatHistory(nextHistory);
    setUserInput('');
    setIsSending(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: {
            ...selectedAgent,
            systemInstruction: tuningInstruction // Send the tuned prompt if customized!
          },
          message: messageToSend,
          history: chatHistory.map(h => ({
            role: h.role,
            text: h.text
          })),
          modelSelection: modelSelection
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to communicate with agent.");
      }

      const data = await response.json();
      setChatHistory(prev => [
        ...prev, 
        { 
          role: 'agent' as const, 
          text: data.response || "No response received.",
          reasoning: data.reasoning
        }
      ]);

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "An error occurred.");
      setChatHistory(prev => [
        ...prev,
        {
          role: 'agent' as const,
          text: "ERROR: Failed to establish agent neural-link. Please verify your GEMINI_API_KEY environment variable is configured in the AI Studio Settings secrets panel."
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveTuning = () => {
    setAgents(prev => prev.map(a => {
      if (a.id === selectedAgent.id) {
        return { ...a, systemInstruction: tuningInstruction };
      }
      return a;
    }));
    setShowTuningSaved(true);
    setTimeout(() => setShowTuningSaved(false), 3000);
  };

  return (
    <div className="grid h-[calc(100vh-130px)] grid-cols-12 gap-4 font-sans text-xs">
      {/* 1. AGENTS SELECTOR (Sidebar) */}
      <div className="col-span-3 overflow-hidden flex flex-col bento-card-premium p-4">
        <h3 className="mb-3 font-display font-semibold text-xs text-indigo-400 uppercase tracking-wider text-white">
          Support Agent Matrix (19 Active)
        </h3>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {agents.map((agt) => {
            const isSelected = agt.id === selectedAgent.id;
            const modeInfo = getAgentOperatingMode(agt.id);
            return (
              <button
                key={agt.id}
                onClick={() => selectAgent(agt)}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 transition-all text-left border.5 cursor-pointer relative group/agent ${
                  isSelected 
                    ? 'bg-indigo-600/20 border-indigo-500/40 text-white shadow-md shadow-indigo-500/5' 
                    : 'border-slate-800/60 bg-slate-900/30 text-slate-300 hover:bg-slate-900/60 hover:border-slate-800/80'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <div className={`${isSelected ? 'text-indigo-400' : 'text-slate-500'}`}>
                    {getAgentIcon(agt.icon)}
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs">{agt.name}</div>
                    <div className="text-[10px] text-slate-400 line-clamp-1">{agt.role}</div>
                    
                    {/* Operating Mode Pill with Interactive Tooltip */}
                    <div className="relative group/mode mt-1 inline-block">
                      <span className={`inline-flex items-center space-x-1 rounded px-1.5 py-0.5 text-[8px] font-bold border ${modeInfo.color}`}>
                        <span className={`h-1 w-1 rounded-full ${modeInfo.glow} animate-pulse`} />
                        <span>{modeInfo.mode}</span>
                      </span>

                      {/* Premium Interactive Tooltip Overlay */}
                      <div className="absolute left-0 top-full mt-1.5 hidden group-hover/mode:block z-50 w-52 rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-[9px] font-mono text-slate-300 shadow-xl leading-normal pointer-events-none">
                        <div className="font-bold text-white mb-1 uppercase tracking-wider text-[8px] flex items-center space-x-1">
                          <Icons.Cpu className="h-2.5 w-2.5 text-indigo-400" />
                          <span>Mode: {modeInfo.mode}</span>
                        </div>
                        <p className="text-slate-400 leading-relaxed font-sans">{modeInfo.guidance}</p>
                        <div className="absolute bottom-full left-4 border-4 border-transparent border-b-slate-800" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-1 shrink-0">
                  <div className="flex items-center space-x-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${agt.isActive ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-rose-500'}`} />
                    <span className="text-[9px] text-slate-500 font-mono font-medium">L{agt.id.includes('support') ? '1' : agt.id.includes('incident') ? '2' : '3'}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. CHAT AND CO-LAB WORKSPACE (Middle) */}
      <div className="col-span-5 flex flex-col bento-card-premium overflow-hidden">
        {/* Agent Info Banner */}
        <div className="flex items-center justify-between border-b border-slate-800/40 bg-slate-950/20 px-4 py-3">
          <div className="flex items-center space-x-2.5">
            <div className="rounded-xl bg-indigo-500/10 p-2 text-indigo-400 border border-indigo-500/15">
              {getAgentIcon(selectedAgent.icon)}
            </div>
            <div>
              <h4 className="font-display font-bold text-sm text-white">{selectedAgent.name}</h4>
              <p className="text-[10px] text-slate-400">{selectedAgent.role}</p>
            </div>
          </div>
          <div className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[9px] font-bold text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/5">
            ONLINE
          </div>
        </div>

        {/* Message Logs */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatHistory.map((msg, i) => (
            <div 
              key={i} 
              className={`flex flex-col max-w-[85%] ${
                msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
              }`}
            >
              {/* Agent Reasoning Stream (simulated) */}
              {msg.reasoning && (
                <div className="mb-2 rounded-lg border border-indigo-500/15 bg-indigo-950/25 px-3 py-2.5 font-mono text-[10px] text-indigo-300 w-full shadow-sm">
                  <div className="flex items-center space-x-1.5 mb-1.5 text-indigo-400 font-bold tracking-wider uppercase text-[8px]">
                    <Icons.Cpu className="h-3 w-3 animate-pulse text-indigo-400" />
                    <span>Agent Co-Processor Reasoning Path</span>
                  </div>
                  <p className="leading-relaxed select-text">{msg.reasoning}</p>
                </div>
              )}

              {/* Message bubble */}
              <div 
                className={`rounded-2xl px-4 py-2.5 text-xs font-sans ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-sm shadow-md' 
                    : 'bg-slate-900/50 border border-slate-800/60 text-slate-200 rounded-tl-sm select-text'
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex items-center space-x-2 text-indigo-400 font-mono text-xxs bg-indigo-500/5 px-3 py-2.5 border border-indigo-500/10 rounded-lg w-max animate-pulse">
              <Icons.Loader2 className="h-3 w-3 animate-spin" />
              <span>Streaming response from {selectedAgent.name} (evaluating toolchain)...</span>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 text-rose-300 font-mono text-[11px] leading-relaxed">
              <div className="flex items-center space-x-1.5 font-bold mb-1.5 text-rose-400 uppercase tracking-wider text-xxs">
                <Icons.AlertTriangle className="h-4 w-4" />
                <span>Neural Bridge Connection Starved</span>
              </div>
              <p>{errorMessage}</p>
            </div>
          )}
        </div>

        {/* Input box */}
        <form onSubmit={handleSendMessage} className="border-t border-slate-800/40 bg-slate-950/10 p-3">
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder={`Instruct ${selectedAgent.name}... (e.g. "analyze our checkout database logs")`}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              disabled={isSending}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/60 py-2.5 pl-3 pr-10 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            <button
              type="submit"
              disabled={isSending || !userInput.trim()}
              className="absolute right-1.5 rounded-lg bg-indigo-600 p-1.5 text-white transition-colors hover:bg-indigo-500 disabled:opacity-40 cursor-pointer"
            >
              <Icons.Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>

      {/* 3. AGENT METADATA & NEURAL PROMPT TUNER (Right) */}
      <div className="col-span-4 flex flex-col space-y-4 overflow-y-auto">
        {/* Agent Attributes Spec */}
        <div className="bento-card-premium p-4 flex flex-col space-y-2.5">
          <h4 className="mb-2 font-display font-semibold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5 text-white">
            <Icons.Database className="h-4 w-4 text-indigo-400" />
            <span>Telemetry Access Profile</span>
          </h4>
          <div className="space-y-3.5">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Core Objectives</div>
              <ul className="list-inside list-disc text-slate-300 space-y-1 pl-1 text-xxs leading-relaxed">
                {selectedAgent.objectives.map((obj, i) => (
                  <li key={i}>{obj}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Active Tool Integrations</div>
              <div className="flex flex-wrap gap-1.5">
                {selectedAgent.tools.map((t) => (
                  <span key={t} className="rounded-lg bg-slate-950 px-2 py-1 font-mono text-[9px] text-indigo-300 border border-slate-800/80">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Permissions & Access Keys</div>
              <div className="flex flex-wrap gap-1.5">
                {selectedAgent.permissions.map((p) => (
                  <span key={p} className="rounded-lg bg-emerald-500/5 px-2.5 py-1 font-mono text-[9px] text-emerald-400 border border-emerald-500/15">
                    {p}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Episodic Buffer Memory</div>
              <div className="space-y-1.5 pl-1 text-xxs leading-relaxed">
                {selectedAgent.memory.length > 0 ? (
                  selectedAgent.memory.map((mem, i) => (
                    <div key={i} className="text-slate-300 flex items-start space-x-1.5">
                      <span className="text-indigo-400 font-bold mt-1">•</span>
                      <span>{mem}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 italic">No persistent local logs cached for this session.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Neural Prompt Tuner */}
        <div className="bento-card-premium p-4 flex flex-col space-y-2">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-display font-semibold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5 text-white">
              <Icons.Cpu className="h-4 w-4 text-indigo-400" />
              <span>Prompt Tuning Console</span>
            </h4>
            <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">System Instruction</span>
          </div>
          <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
            Directly adjust the underlying system prompt instruction that defines this agent's diagnostic logic. Updates apply immediately.
          </p>
          <textarea
            value={tuningInstruction}
            onChange={(e) => setTuningInstruction(e.target.value)}
            rows={5}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 p-2.5 font-mono text-[10px] text-emerald-300 placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
          <div className="mt-2 flex items-center justify-between">
            {showTuningSaved ? (
              <span className="text-[10px] text-emerald-400 font-semibold flex items-center space-x-1 animate-pulse">
                <Icons.Check className="h-3 w-3" />
                <span>Prompt Synced Successfully</span>
              </span>
            ) : <span />}
            <button
              onClick={handleSaveTuning}
              className="rounded-lg bg-indigo-600 px-3.5 py-1.5 font-bold text-white transition-colors hover:bg-indigo-500 cursor-pointer text-xxs"
            >
              Sync Prompt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { SupportAgent } from '../types';
import { SeedAgents } from '../data/simulation';
import * as Icons from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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

const generateAgentHeatmapData = (agentId: string, mode: 'efficiency' | 'cost' = 'efficiency') => {
  // Use a deterministic seed/hash based on agentId string to generate slightly different profiles
  const seed = agentId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const data = [];
  for (let i = 23; i >= 0; i--) {
    const hour = (new Date().getHours() - i + 24) % 24;
    const hourStr = `${hour.toString().padStart(2, '0')}:00`;
    
    // Vary efficiency between 82% and 100%
    const efficiencyFactor = (seed + i * 7) % 18;
    const efficiency = 100 - efficiencyFactor;

    // Vary response time between 80ms and 480ms
    const baseLatency = agentId.includes('support') ? 110 : agentId.includes('db') ? 170 : 310;
    const latencyFactor = (seed * i + i * 3) % 180;
    const responseTime = baseLatency + latencyFactor;

    // Task count
    const taskCount = ((seed * 3 + i * 11) % 14) + 4;

    // Cost parameters
    const modelTierFactor = agentId.includes('root_cause') || agentId.includes('reporting') || agentId.includes('database') ? 3 : agentId.includes('incident') ? 2 : 1.2;
    const baseCost = 0.015 * modelTierFactor;
    const usageCost = (taskCount * 0.005) + ((responseTime / 500) * 0.01);
    const costPerHour = Math.round((baseCost + usageCost) * 1000) / 1000;
    const memoryUtilizationMb = 128 + ((seed + i * 13) % 256); // 128MB to 384MB

    // Color intensity based on efficiency and response time or cost
    let colorClass = 'bg-emerald-500/80';
    let status: 'Active' | 'Error' | 'Maintenance' | 'Idle' = 'Active';
    if (efficiency < 88) {
      status = 'Error';
      colorClass = 'bg-rose-500/80 hover:bg-rose-400';
    } else if (efficiency < 94) {
      status = 'Maintenance';
      colorClass = 'bg-amber-500/80 hover:bg-amber-400';
    } else if (responseTime > 340) {
      status = 'Idle';
      colorClass = 'bg-indigo-500/80 hover:bg-indigo-400';
    } else {
      status = 'Active';
      colorClass = 'bg-emerald-500/60 hover:bg-emerald-400';
    }

    if (mode === 'cost') {
      // Cost Benchmarking Colors: higher cost shown in amber/rose, lower in emerald/slate
      if (costPerHour > 0.08) {
        colorClass = 'bg-rose-600/70 hover:bg-rose-500';
      } else if (costPerHour > 0.05) {
        colorClass = 'bg-amber-600/70 hover:bg-amber-500';
      } else if (costPerHour > 0.03) {
        colorClass = 'bg-indigo-600/70 hover:bg-indigo-500';
      } else {
        colorClass = 'bg-emerald-600/50 hover:bg-emerald-500';
      }
    }

    data.push({
      hourAgo: i,
      hourStr,
      efficiency,
      responseTime,
      taskCount,
      costPerHour,
      memoryUtilizationMb,
      colorClass,
      status,
    });
  }
  return data;
};

interface StateTransition {
  timestamp: string;
  fromState: 'Idle' | 'Active' | 'Error' | 'Maintenance';
  toState: 'Idle' | 'Active' | 'Error' | 'Maintenance';
  description: string;
  operator?: string;
  latencyMs?: number;
}

const getAgentTimelineHistory = (agentId: string, timeframe: '1h' | '6h' | '24h' = '1h'): StateTransition[] => {
  const seed = agentId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const now = new Date();
  const transitions: StateTransition[] = [];
  
  const isDB = agentId.includes('db') || agentId.includes('database');
  const isSupport = agentId.includes('support');
  const isK8s = agentId.includes('k8s');
  const isRootCause = agentId.includes('root_cause');

  const count = timeframe === '1h' ? 4 : timeframe === '6h' ? 8 : 14;
  const timeStepMins = timeframe === '1h' ? 12 : timeframe === '6h' ? 40 : 100;

  for (let i = 0; i < count; i++) {
    const eventTime = new Date(now.getTime() - i * timeStepMins * 60000);
    const timeStr = eventTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    // Deterministic state selection
    const stateSelector = (seed + i * 17) % 4;
    const states: Array<'Idle' | 'Active' | 'Error' | 'Maintenance'> = ['Idle', 'Active', 'Error', 'Maintenance'];
    
    const fromState = states[stateSelector];
    const toState = states[(stateSelector + 1) % 4];

    let description = '';
    if (isDB) {
      if (toState === 'Active') description = 'Evaluating database connections and transaction lock contention lists.';
      else if (toState === 'Error') description = 'Breached connection pool limit (100/100 connections exhausted).';
      else if (toState === 'Maintenance') description = 'Broadcasting pool recycling commands via safe execution sandbox.';
      else description = 'Completed transaction profile sync. Standing by for schema telemetry spikes.';
    } else if (isSupport) {
      if (toState === 'Active') description = 'Ingested new high-tier ticket update. Synthesizing empathetic Slack response draft.';
      else if (toState === 'Error') description = 'OpenAI API connection timeout (exceeded 15s retry window).';
      else if (toState === 'Maintenance') description = 'Flushing outdated customer conversational context matrices.';
      else description = 'Inactivity threshold triggered. Safe-idle standby active.';
    } else if (isK8s) {
      if (toState === 'Active') description = 'Scanning namespace pods for crash loop backoffs and OOM exits.';
      else if (toState === 'Error') description = 'Container registration failure: Service core port 3000 refused handshakes.';
      else if (toState === 'Maintenance') description = 'Performing graceful rolling restart on billing core pod replicas.';
      else description = 'Completed node telemetry scrape. Listening for KubeAPI events.';
    } else if (isRootCause) {
      if (toState === 'Active') description = 'Correlating multi-dimensional traces with slow PostgreSQL log transactions.';
      else if (toState === 'Error') description = 'Insufficient trace density to calculate correlation confidence metrics.';
      else if (toState === 'Maintenance') description = 'Updating root-cause rule indices following major commit release.';
      else description = 'Diagnostic timeline compiled and handed off to CTO cockpit. System idle.';
    } else {
      if (toState === 'Active') description = 'Processing queued system triggers and telemetry streams.';
      else if (toState === 'Error') description = 'Sub-thread execution buffer overflowed. Retrying task handshake.';
      else if (toState === 'Maintenance') description = 'Flushing sub-agent memory buffers and running dependency sync.';
      else description = 'Task execution stack cleared. Moving to system sleep.';
    }

    transitions.push({
      timestamp: timeStr,
      fromState,
      toState,
      description,
      operator: i % 3 === 0 ? 'CTO Daemon' : 'Auto-Scaler Core',
      latencyMs: 40 + ((seed + i * 9) % 320)
    });
  }

  return transitions;
};

const getAgentScaleFactor = (agentId: string, isAutoScaling: boolean) => {
  if (!isAutoScaling) return 1;
  if (agentId.includes('database') || agentId.includes('k8s') || agentId.includes('root_cause')) {
    return 3;
  }
  if (agentId.includes('metrics') || agentId.includes('log') || agentId.includes('tracing')) {
    return 2;
  }
  return 1;
};

export default function AgentOrchestrator({ modelSelection }: AgentOrchestratorProps) {
  const [agents, setAgents] = useState<SupportAgent[]>(SeedAgents);
  const [selectedAgent, setSelectedAgent] = useState<SupportAgent>(SeedAgents[0]);
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'agent', text: string, reasoning?: string }>>([]);
  const [userInput, setUserInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Benchmarking and scaling states
  const [benchmarkingMode, setBenchmarkingMode] = useState<'efficiency' | 'cost'>('efficiency');
  const [isAutoScaling, setIsAutoScaling] = useState<boolean>(false);
  const [isTimelineOverlayOpen, setIsTimelineOverlayOpen] = useState<boolean>(false);
  const [timelineTimeframe, setTimelineTimeframe] = useState<'1h' | '6h' | '24h'>('1h');

  // Live Data and Filtering states
  const [isLiveDataEnabled, setIsLiveDataEnabled] = useState<boolean>(false);
  const [lastPollTime, setLastPollTime] = useState<string | null>(null);
  const [pollMetrics, setPollMetrics] = useState<any>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['Active', 'Error', 'Maintenance', 'Idle']);

  // Background polling effect for live agent status updates (every 5 seconds)
  React.useEffect(() => {
    if (!isLiveDataEnabled) return;
    
    const performPoll = async () => {
      try {
        const response = await fetch('/api/aspnet/agents/poll');
        if (response.ok) {
          const data = await response.json();
          setPollMetrics(data);
          setLastPollTime(new Date().toLocaleTimeString());
          
          // Randomly update agent metrics slightly in real-time
          setAgents(prevAgents => 
            prevAgents.map(agent => {
              const delta = (Math.random() * 3 - 1.5) + (data.metricsShiftPct || 0);
              const nextAvgEfficiency = Math.min(100, Math.max(78, Math.round((agent.metrics?.avgEfficiency || 95) + delta)));
              const nextAvgResponseTime = Math.max(45, Math.round((agent.metrics?.avgResponseTimeMs || 200) + (data.latencyDeltaMs || 0) + (Math.random() * 8 - 4)));
              return {
                ...agent,
                metrics: {
                  ...agent.metrics,
                  avgEfficiency: nextAvgEfficiency,
                  avgResponseTimeMs: nextAvgResponseTime,
                  successfulRuns: (agent.metrics?.successfulRuns || 0) + Math.floor(Math.random() * 2),
                  failedRuns: (agent.metrics?.failedRuns || 0) + (Math.random() > 0.95 ? 1 : 0)
                }
              };
            })
          );

          // Sync currently selected agent
          setSelectedAgent(prevSelected => {
            const delta = (Math.random() * 3 - 1.5) + (data.metricsShiftPct || 0);
            const nextAvgEfficiency = Math.min(100, Math.max(78, Math.round((prevSelected.metrics?.avgEfficiency || 95) + delta)));
            const nextAvgResponseTime = Math.max(45, Math.round((prevSelected.metrics?.avgResponseTimeMs || 200) + (data.latencyDeltaMs || 0) + (Math.random() * 8 - 4)));
            return {
              ...prevSelected,
              metrics: {
                ...prevSelected.metrics,
                avgEfficiency: nextAvgEfficiency,
                avgResponseTimeMs: nextAvgResponseTime,
                successfulRuns: (prevSelected.metrics?.successfulRuns || 0) + Math.floor(Math.random() * 2),
                failedRuns: (prevSelected.metrics?.failedRuns || 0) + (Math.random() > 0.95 ? 1 : 0)
              }
            };
          });
        }
      } catch (err) {
        console.error("Agent Live Data Polling Exception:", err);
      }
    };

    performPoll();
    const intervalId = setInterval(performPoll, 5000);
    return () => clearInterval(intervalId);
  }, [isLiveDataEnabled]);

  // Heatmap hover details state
  const [hoveredCell, setHoveredCell] = useState<any>(null);

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

  const handleDownloadSnapshot = () => {
    const snapshotData = agents.map(agent => {
      return {
        agentId: agent.id,
        name: agent.name,
        role: agent.role,
        operatingMode: getAgentOperatingMode(agent.id).mode,
        systemInstruction: agent.systemInstruction,
        tools: agent.tools,
        metrics: agent.metrics,
        scaleFactor: getAgentScaleFactor(agent.id, isAutoScaling),
        heatmapEfficiencyAndCost: generateAgentHeatmapData(agent.id, benchmarkingMode).map(cell => ({
          timeframe: cell.hourStr,
          hoursAgo: cell.hourAgo,
          efficiencyPct: cell.efficiency,
          responseTimeMs: cell.responseTime,
          taskCount: cell.taskCount,
          costPerHour: cell.costPerHour,
          memoryMb: cell.memoryUtilizationMb,
          status: cell.status
        })),
        stateTransitionLogs: getAgentTimelineHistory(agent.id, '24h')
      };
    });

    const blob = new Blob([JSON.stringify({
      snapshotTimestamp: new Date().toISOString(),
      benchmarkingMode,
      isAutoScalingActive: isAutoScaling,
      isLiveDataEnabled: isLiveDataEnabled,
      totalActiveAgents: isAutoScaling ? 24 : 19,
      agents: snapshotData
    }, null, 2)], { type: 'application/json' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SupportPilot_Agent_Orchestrator_Snapshot_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold text-xs text-indigo-400 uppercase tracking-wider text-white">
            Support Agent Matrix ({isAutoScaling ? '24' : '19'} Active)
          </h3>
        </div>

        {/* Telemetry Control Panel */}
        <div className="mb-3 bg-slate-950/80 border border-slate-900 rounded-xl p-3 space-y-3">
          {/* 1. Auto-Scale Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Icons.Zap className={`h-3.5 w-3.5 transition-all ${isAutoScaling ? 'text-amber-400 animate-bounce' : 'text-slate-500'}`} />
              <div>
                <div className="font-bold text-white text-[10px] uppercase tracking-wider">Auto-Scale</div>
                <div className="text-[8px] text-slate-500 font-mono">Load-based auto-scaler</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const nextVal = !isAutoScaling;
                setIsAutoScaling(nextVal);
                setChatHistory(prev => [
                  ...prev,
                  {
                    role: 'agent',
                    text: nextVal 
                      ? "SYSTEM ALIGNED: Auto-Scale protocol initiated.\nSystem detected high-frequency telemetry query pressure on active clusters. Reallocating incident processing subagents:\n- Database Agent: Horizontal scale increased to 3 execution threads.\n- Kubernetes Agent: Scaled horizontal worker count to 3 replicas.\n- Root Cause Agent: Parallel multi-path trace indexing enabled (+150% throughput)."
                      : "SYSTEM ALIGNED: Auto-Scale protocol deactivated.\nReverting horizontal replica allocations back to L1/L2/L3 default baseline pools.",
                    reasoning: nextVal 
                      ? "AUTO_SCALE_DAEMON: Analyzing high-frequency metrics. Outage volume trend shows concurrency locks on FintechPay database. Reallocating thread pools to isolate latch deadlocks dynamically."
                      : "AUTO_SCALE_DAEMON: Traffic payload returned to safe nominal window (<200 transactions/sec). Deprovisioning active thread reserves gracefully."
                  }
                ]);
              }}
              className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isAutoScaling ? 'bg-indigo-600' : 'bg-slate-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isAutoScaling ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 2. Live Data Polling Toggle */}
          <div className="flex items-center justify-between border-t border-slate-900/60 pt-2.5">
            <div className="flex items-center space-x-2">
              <Icons.Radio className={`h-3.5 w-3.5 transition-all ${isLiveDataEnabled ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
              <div>
                <div className="font-bold text-white text-[10px] uppercase tracking-wider">Live Polling</div>
                <div className="text-[8px] text-slate-500 font-mono">Poll backend (every 5s)</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsLiveDataEnabled(!isLiveDataEnabled)}
              className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isLiveDataEnabled ? 'bg-emerald-600' : 'bg-slate-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isLiveDataEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 3. Download Snapshot Button */}
          <div className="border-t border-slate-900/60 pt-2.5">
            <button
              type="button"
              onClick={handleDownloadSnapshot}
              className="w-full rounded bg-slate-900 hover:bg-slate-850 hover:text-white border border-slate-800 hover:border-indigo-500 text-slate-300 font-mono text-[9px] font-bold py-1.5 flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-md"
            >
              <Icons.Download className="h-3 w-3 text-indigo-400" />
              <span>Download Snapshot</span>
            </button>
          </div>

          {/* Active status indicator */}
          {isLiveDataEnabled && (
            <div className="border-t border-slate-900/60 pt-1.5 flex items-center justify-between text-[8px] font-mono">
              <span className="text-emerald-400 flex items-center space-x-1 animate-pulse">
                <span className="h-1 w-1 bg-emerald-400 rounded-full" />
                <span>POLLING ACTIVE</span>
              </span>
              <span className="text-slate-500">
                Last: {lastPollTime || 'Pending...'}
              </span>
            </div>
          )}

          {isAutoScaling && !isLiveDataEnabled && (
            <div className="mt-2 border-t border-slate-900 pt-1.5 text-[8.5px] font-mono text-amber-400 leading-normal flex items-start space-x-1 animate-pulse">
              <span className="font-bold">●</span>
              <span>Metric Trigger: High-Frequency Transaction Pools (+26% cap)</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {agents.map((agt) => {
            const isSelected = agt.id === selectedAgent.id;
            const modeInfo = getAgentOperatingMode(agt.id);
            const scaleFactor = getAgentScaleFactor(agt.id, isAutoScaling);
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
                    
                    {/* Operating Mode Pill with Interactive Tooltip & Optional Scale Badge */}
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      <div className="relative group/mode inline-block">
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

                      {isAutoScaling && scaleFactor > 1 && (
                        <span className="inline-flex items-center space-x-1 rounded bg-amber-500/10 px-1 py-0.5 text-[7.5px] font-bold text-amber-400 border border-amber-500/15 animate-pulse shrink-0">
                          <Icons.Cpu className="h-2 w-2" />
                          <span>{scaleFactor}x ths</span>
                        </span>
                      )}
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
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsTimelineOverlayOpen(true)}
              className="rounded bg-slate-900 border border-slate-800 hover:border-indigo-500 hover:text-white px-2 py-1 font-mono text-[9px] font-bold text-slate-400 flex items-center space-x-1 transition-all cursor-pointer shadow-md"
            >
              <Icons.History className="h-3 w-3 text-indigo-400" />
              <span>Timeline History</span>
            </button>
            <div className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[9px] font-bold text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/5">
              ONLINE
            </div>
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
        
        {/* 24h AI Agent Task Efficiency & Response Time Heatmap */}
        <div className="bento-card-premium p-4 flex flex-col space-y-3">
          <div className="flex items-center justify-between border-b border-slate-900 pb-2">
            <h4 className="font-display font-semibold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5 text-white">
              <Icons.Activity className="h-4 w-4 text-indigo-400 animate-pulse" />
              <span>24h Task Co-Processor Heatmap</span>
            </h4>
            
            {/* Performance Benchmarking Toggle */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center bg-slate-950 border border-slate-900 rounded-lg p-0.5 select-none shrink-0">
                <button
                  type="button"
                  onClick={() => setBenchmarkingMode('efficiency')}
                  className={`px-2 py-0.5 rounded text-[8px] font-bold transition-all cursor-pointer ${
                    benchmarkingMode === 'efficiency'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Efficiency
                </button>
                <button
                  type="button"
                  onClick={() => setBenchmarkingMode('cost')}
                  className={`px-2 py-0.5 rounded text-[8px] font-bold transition-all cursor-pointer ${
                    benchmarkingMode === 'cost'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Cost
                </button>
              </div>

              {/* Tooltip Icon & Popover */}
              <div className="relative group/help">
                <Icons.HelpCircle className="h-3.5 w-3.5 text-slate-500 hover:text-white transition-colors cursor-pointer" />
                <div className="absolute right-0 top-full mt-2 hidden group-hover/help:block z-50 w-52 rounded-xl border border-slate-800 bg-slate-950 p-3 text-[9px] font-mono text-slate-400 shadow-xl leading-normal pointer-events-none">
                  <div className="font-bold text-white mb-1 uppercase tracking-wider text-[8px] flex items-center space-x-1">
                    <Icons.Cpu className="h-2.5 w-2.5 text-indigo-400" />
                    <span>Metrics Matrix Calculation</span>
                  </div>
                  <p className="text-slate-400 font-sans leading-relaxed">
                    Efficiency maps response speed and accuracy loops. Cost maps actual token, API, and virtual machine core utilization overhead in dollars.
                  </p>
                  <div className="absolute bottom-full right-1 border-4 border-transparent border-b-slate-800" />
                </div>
              </div>
            </div>
          </div>          <div className="text-[10px] text-slate-400 leading-relaxed">
            {benchmarkingMode === 'efficiency' 
              ? 'Hourly visual matrix mapping task load, response speed, and operational accuracy:' 
              : 'Hourly visual matrix mapping model execution cost and container memory overhead footprint:'}
          </div>

          {/* Heatmap Status Filter Chips */}
          <div className="flex items-center space-x-1.5 flex-wrap pt-0.5 pb-1">
            <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wider mr-1">Filter status:</span>
            {[
              { id: 'Active', label: 'Active', bg: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20', activeBg: 'bg-emerald-500 text-slate-950 font-bold border border-emerald-500' },
              { id: 'Error', label: 'Error', bg: 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20', activeBg: 'bg-rose-500 text-slate-950 font-bold border border-rose-500' },
              { id: 'Maintenance', label: 'Maintenance', bg: 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20', activeBg: 'bg-amber-500 text-slate-950 font-bold border border-amber-500' },
              { id: 'Idle', label: 'Idle / Standby', bg: 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20', activeBg: 'bg-indigo-500 text-slate-950 font-bold border border-indigo-500' }
            ].map(status => {
              const isActive = selectedStatuses.includes(status.id);
              return (
                <button
                  key={status.id}
                  type="button"
                  onClick={() => {
                    if (isActive) {
                      if (selectedStatuses.length > 1) {
                        setSelectedStatuses(prev => prev.filter(s => s !== status.id));
                      }
                    } else {
                      setSelectedStatuses(prev => [...prev, status.id]);
                    }
                  }}
                  className={`px-2 py-0.5 rounded text-[8px] font-mono transition-all cursor-pointer ${
                    isActive ? status.activeBg : `${status.bg} opacity-40`
                  }`}
                >
                  {status.label}
                </button>
              );
            })}
          </div>

          {/* Grid of 24 blocks (2 rows of 12 hours) */}
          <div className="grid grid-cols-12 gap-1 bg-slate-950 p-2.5 rounded-lg border border-slate-900/60">
            {generateAgentHeatmapData(selectedAgent.id, benchmarkingMode).map((cell, idx) => {
              const isFilteredIn = selectedStatuses.includes(cell.status);
              return (
                <div
                  key={idx}
                  onMouseEnter={() => isFilteredIn && setHoveredCell(cell)}
                  onMouseLeave={() => setHoveredCell(null)}
                  className={`h-4 rounded-sm transition-all duration-150 border border-slate-950 ${
                    isFilteredIn 
                      ? `${cell.colorClass} cursor-crosshair hover:scale-110 hover:shadow-lg hover:shadow-indigo-500/10` 
                      : 'bg-slate-900/10 opacity-15 pointer-events-none'
                  }`}
                />
              );
            })}
          </div>

          {/* Hover Status Box */}
          <div className="rounded-lg bg-slate-950/60 border border-slate-900 p-2 min-h-[44px] flex flex-col justify-center text-xxs font-mono text-slate-400">
            {hoveredCell ? (
              benchmarkingMode === 'efficiency' ? (
                <div className="grid grid-cols-3 gap-2 text-center text-[9px]">
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase block">Timeframe</span>
                    <span className="text-slate-200 font-bold">{hoveredCell.hourStr} (-{hoveredCell.hourAgo}h)</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase block">Efficiency</span>
                    <span className={`font-bold ${hoveredCell.efficiency >= 94 ? 'text-emerald-400' : hoveredCell.efficiency >= 88 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {hoveredCell.efficiency}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase block">Response</span>
                    <span className="text-indigo-400 font-bold">{hoveredCell.responseTime}ms</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 text-center text-[9px]">
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase block">Timeframe</span>
                    <span className="text-slate-200 font-bold">{hoveredCell.hourStr} (-{hoveredCell.hourAgo}h)</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase block">Compute Cost</span>
                    <span className="text-emerald-400 font-bold">
                      ${hoveredCell.costPerHour.toFixed(3)}/hr
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase block">Memory Footprint</span>
                    <span className="text-indigo-400 font-bold">{hoveredCell.memoryUtilizationMb} MB</span>
                  </div>
                </div>
              )
            ) : (
              <div className="text-center italic text-slate-500 text-[9px] flex items-center justify-center space-x-1.5">
                <Icons.Sparkles className="h-3 w-3 text-indigo-400 animate-pulse" />
                <span>Hover over the heatmap cells for detailed telemetry metrics</span>
              </div>
            )}
          </div>
        </div>

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

      {/* TIMELINE HISTORY OVERLAY MODAL */}
      <AnimatePresence>
        {isTimelineOverlayOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn"
            onClick={() => setIsTimelineOverlayOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] font-sans"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-4">
                <div className="flex items-center space-x-3">
                  <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400 border border-indigo-500/20">
                    {getAgentIcon(selectedAgent.icon)}
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-sm text-white flex items-center space-x-2">
                      <span>{selectedAgent.name} Transition Ledger</span>
                    </h3>
                    <p className="text-[10px] text-slate-400">Granular state transition chronology & operation log</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTimelineOverlayOpen(false)}
                  className="rounded-lg p-1.5 text-slate-500 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <Icons.X className="h-4 w-4" />
                </button>
              </div>

              {/* Timeframe selector */}
              <div className="flex items-center justify-between mb-4 bg-slate-900/40 border border-slate-900/60 p-2 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1.5">Select Timeframe:</span>
                <div className="flex items-center bg-slate-950 border border-slate-900 rounded-lg p-0.5">
                  {(['1h', '6h', '24h'] as const).map((tf) => (
                    <button
                      type="button"
                      key={tf}
                      onClick={() => setTimelineTimeframe(tf)}
                      className={`px-3 py-1 rounded text-[9px] font-bold transition-all cursor-pointer ${
                        timelineTimeframe === tf
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {tf === '1h' ? 'Past 1 Hour' : tf === '6h' ? 'Past 6 Hours' : 'Past 24 Hours'}
                    </button>
                  ))}
                </div>
              </div>

              {/* State Transitions list */}
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 mb-2">
                {getAgentTimelineHistory(selectedAgent.id, timelineTimeframe).map((t, index) => {
                  const getBadgeColor = (st: 'Idle' | 'Active' | 'Error' | 'Maintenance') => {
                    switch (st) {
                      case 'Active': return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20';
                      case 'Idle': return 'bg-slate-800/60 text-slate-400 border border-slate-800';
                      case 'Error': return 'bg-rose-500/15 text-rose-400 border border-rose-500/20';
                      case 'Maintenance': return 'bg-amber-500/15 text-amber-400 border border-amber-500/20';
                    }
                  };

                  return (
                    <div key={index} className="relative pl-5 border-l border-slate-800/80 last:border-0 pb-1.5 text-left">
                      {/* Timeline dot */}
                      <div className="absolute left-[-4.5px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-800 border-2 border-slate-950" />
                      
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-[10px] font-black text-slate-500">{t.timestamp}</span>
                          <div className="flex items-center space-x-1">
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${getBadgeColor(t.fromState)}`}>{t.fromState}</span>
                            <Icons.ArrowRight className="h-2.5 w-2.5 text-slate-600" />
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${getBadgeColor(t.toState)}`}>{t.toState}</span>
                          </div>
                        </div>
                        <span className="text-[9px] text-slate-600 font-mono">lat: {t.latencyMs}ms</span>
                      </div>
                      
                      <p className="mt-1.5 text-slate-300 text-[10.5px] font-sans leading-relaxed">
                        {t.description}
                      </p>
                      
                      <div className="mt-1 flex items-center space-x-1 text-[8.5px] text-slate-500 font-mono">
                        <Icons.User className="h-2.5 w-2.5 text-slate-600" />
                        <span>Triggered by: {t.operator}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="border-t border-slate-900 pt-3 flex items-center justify-between text-[9px] font-mono text-slate-500">
                <span className="flex items-center space-x-1.5">
                  <Icons.Shield className="h-3 w-3 text-emerald-500" />
                  <span>State audits fully compliant</span>
                </span>
                <span>ID: {selectedAgent.id}</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

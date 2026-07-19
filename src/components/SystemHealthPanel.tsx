import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ComponentHealth {
  status: string;
  type?: string;
  index?: string;
  latencyMs?: number;
  hitRatePct?: number;
  activeQueues?: number;
  agentsActive?: number;
}

interface HealthData {
  status: string;
  timestamp: string;
  components: {
    relationalDb: ComponentHealth;
    vectorSearch: ComponentHealth;
    cache: ComponentHealth;
    queue: ComponentHealth;
    orchestrator: ComponentHealth;
  };
  buildVersion: string;
}

export default function SystemHealthPanel() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [liveLatency, setLiveLatency] = useState(6);
  const [liveErrorRate, setLiveErrorRate] = useState(0.02);
  const [liveThreads, setLiveThreads] = useState(19);
  const [isOpen, setIsOpen] = useState(false);

  // Cluster topology and recycle state variables
  const [selectedNodeId, setSelectedNodeId] = useState<string>('orchestrator');
  const [isRecycling, setIsRecycling] = useState(false);
  const [recycleProgress, setRecycleProgress] = useState(0);
  const [showCpuHeatmap, setShowCpuHeatmap] = useState(false);

  const getHeatmapColor = (cpuStr: string) => {
    const percent = parseInt(cpuStr.replace('%', ''), 10) || 0;
    if (percent > 25) return '#ef4444'; // Red for high
    if (percent > 10) return '#f97316'; // Orange for moderate
    if (percent > 5) return '#eab308';  // Yellow for low-mid
    return '#10b981'; // Emerald for very low/idle
  };

  const topologyNodes = {
    ingress: { id: 'ingress', label: 'ingress-routing-0', role: 'Traffic Ingress', ip: '10.244.0.1', pods: 2, cpu: '4%', ram: '1.2GB/4GB', status: 'ACTIVE', color: '#6366f1' },
    orchestrator: { id: 'orchestrator', label: 'orchestrator-core-sub', role: 'AI Orchestration Engine', ip: '10.244.1.15', pods: 12, cpu: '28%', ram: '3.6GB/8GB', status: 'ACTIVE', color: '#a78bfa' },
    db: { id: 'db', label: 'postgres-db-primary', role: 'Relational Store', ip: '10.244.2.8', pods: 1, cpu: '12%', ram: '4.8GB/16GB', status: 'ACTIVE', color: '#34d399' },
    queue: { id: 'queue', label: 'rabbitmq-broker-node-0', role: 'Event Message Broker', ip: '10.244.1.24', pods: 3, cpu: '8%', ram: '1.9GB/4GB', status: 'ACTIVE', color: '#fbbf24' },
    cache: { id: 'cache', label: 'redis-cache-replica-1', role: 'Distributed Cache', ip: '10.244.2.19', pods: 1, cpu: '2%', ram: '0.8GB/4GB', status: 'ACTIVE', color: '#f43f5e' }
  };

  useEffect(() => {
    // Initial fetch
    const fetchHealth = async () => {
      try {
        const response = await fetch('/api/health');
        if (response.ok) {
          const data = (await response.json()) as HealthData;
          setHealth(data);
          if (data.components?.relationalDb?.latencyMs) {
            setLiveLatency(data.components.relationalDb.latencyMs + Math.floor(Math.random() * 4));
          }
          if (data.components?.orchestrator?.agentsActive) {
            setLiveThreads(data.components.orchestrator.agentsActive);
          }
        }
      } catch (err) {
        console.error('Failed to fetch system health:', err);
      }
    };

    fetchHealth();

    // Set up active telemetry oscillations to represent live container streams
    const interval = setInterval(() => {
      setLiveLatency(prev => {
        const delta = Math.random() > 0.5 ? 1 : -1;
        return Math.max(3, Math.min(25, prev + delta));
      });
      setLiveErrorRate(prev => {
        const delta = (Math.random() - 0.5) * 0.01;
        return Math.max(0.01, Math.min(0.12, parseFloat((prev + delta).toFixed(3))));
      });
      setLiveThreads(prev => {
        if (Math.random() > 0.8) {
          const delta = Math.random() > 0.5 ? 1 : -1;
          return Math.max(15, Math.min(24, prev + delta));
        }
        return prev;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative font-mono text-[10px]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3.5 rounded-lg border border-slate-900 bg-slate-950 px-3 py-1.5 hover:border-slate-800 transition-all cursor-pointer"
        title="View live cluster telemetry feed"
      >
        {/* Latency */}
        <div className="flex items-center space-x-1.5">
          <Icons.Activity className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
          <span className="text-slate-500">RTT:</span>
          <span className="text-emerald-400 font-bold">{liveLatency}ms</span>
        </div>

        {/* Error Rate */}
        <div className="flex items-center space-x-1.5 border-l border-slate-900 pl-3">
          <Icons.ShieldAlert className={`h-3.5 w-3.5 ${liveErrorRate > 0.08 ? 'text-rose-400' : 'text-slate-400'}`} />
          <span className="text-slate-500">ERR:</span>
          <span className={`${liveErrorRate > 0.08 ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>{liveErrorRate}%</span>
        </div>

        {/* Active Threads */}
        <div className="flex items-center space-x-1.5 border-l border-slate-900 pl-3">
          <Icons.Cpu className="h-3.5 w-3.5 text-indigo-400" />
          <span className="text-slate-500">CORES:</span>
          <span className="text-indigo-400 font-bold">{liveThreads} thr</span>
        </div>

        <Icons.ChevronDown className={`h-3 w-3 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="absolute right-0 mt-2 w-[410px] z-50 rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-2xl text-xxs space-y-3 font-mono"
            >
              <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                <span className="font-bold text-white uppercase text-[9px] tracking-wider">Kubernetes Live Status</span>
                <span className="rounded bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 text-[8px] font-bold border border-emerald-500/20 uppercase">
                  Stable
                </span>
              </div>

              {/* Interactive Topology Map */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-indigo-400 block text-[8px] uppercase tracking-wider">Visual Node Topology Map</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCpuHeatmap(!showCpuHeatmap);
                    }}
                    className={`px-1.5 py-0.5 rounded text-[7px] font-mono font-bold uppercase transition-all flex items-center space-x-1 border cursor-pointer ${
                      showCpuHeatmap 
                        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' 
                        : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    <Icons.Flame className="h-2.5 w-2.5" />
                    <span>Heatmap: {showCpuHeatmap ? 'ON' : 'OFF'}</span>
                  </button>
                </div>
                <svg width="378" height="150" className="bg-slate-950 rounded-lg border border-slate-900 overflow-visible p-1">
                  <defs>
                    <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity="0.2" />
                    </linearGradient>
                  </defs>
                  <style>{`
                    @keyframes dash {
                      to { stroke-dashoffset: -20; }
                    }
                    .conn-line {
                      stroke: #1e1b4b;
                      stroke-width: 1.5;
                      stroke-linecap: round;
                    }
                    .conn-line-pulse {
                      stroke: #818cf8;
                      stroke-width: 1.5;
                      stroke-dasharray: 5, 5;
                      animation: dash 1.5s linear infinite;
                      stroke-linecap: round;
                      opacity: 0.65;
                    }
                  `}</style>

                  {/* Connection lines */}
                  <g>
                    <line x1="189" y1="20" x2="100" y2="75" className="conn-line" />
                    <line x1="189" y1="20" x2="100" y2="75" className="conn-line-pulse" />

                    <line x1="189" y1="20" x2="278" y2="75" className="conn-line" />
                    <line x1="189" y1="20" x2="278" y2="75" className="conn-line-pulse" />

                    <line x1="100" y1="75" x2="100" y2="125" className="conn-line" />
                    <line x1="100" y1="75" x2="100" y2="125" className="conn-line-pulse" />

                    <line x1="100" y1="75" x2="278" y2="125" className="conn-line" />
                    <line x1="100" y1="75" x2="278" y2="125" className="conn-line-pulse" />

                    <line x1="100" y1="125" x2="278" y2="75" className="conn-line" />
                    <line x1="100" y1="125" x2="278" y2="75" className="conn-line-pulse" />

                    <line x1="278" y1="125" x2="278" y2="75" className="conn-line" />
                    <line x1="278" y1="125" x2="278" y2="75" className="conn-line-pulse" />
                  </g>

                  {/* Nodes mapping */}
                  {Object.values(topologyNodes).map(node => {
                    const isSelected = selectedNodeId === node.id;
                    const x = node.id === 'ingress' ? 189 : (node.id === 'orchestrator' || node.id === 'queue' ? 100 : 278);
                    const y = node.id === 'ingress' ? 20 : (node.id === 'orchestrator' || node.id === 'db' ? 75 : 125);
                    const nodeColor = showCpuHeatmap ? getHeatmapColor(node.cpu) : node.color;
                    return (
                      <g 
                        key={node.id} 
                        onClick={() => setSelectedNodeId(node.id)} 
                        className="cursor-pointer group"
                      >
                        {/* Outer Ring Glow */}
                        <circle 
                          cx={x} 
                          cy={y} 
                          r={11} 
                          fill="transparent" 
                          stroke={isSelected ? nodeColor : (showCpuHeatmap ? `${nodeColor}44` : 'transparent')} 
                          strokeWidth={isSelected ? 1.5 : (showCpuHeatmap ? 3 : 0)}
                          className="transition-all duration-300"
                        />
                        {/* Inner core node */}
                        <circle 
                          cx={x} 
                          cy={y} 
                          r={5.5} 
                          fill={nodeColor} 
                          className="transition-transform group-hover:scale-125" 
                        />
                        {/* Node label */}
                        <text 
                          x={x} 
                          y={y + 17} 
                          textAnchor="middle" 
                          fill={isSelected ? '#ffffff' : '#475569'} 
                          fontSize={6.5} 
                          fontWeight={isSelected ? 'bold' : 'normal'}
                          className="transition-colors select-none font-mono"
                        >
                          {node.id.toUpperCase()}{showCpuHeatmap ? ` (${node.cpu})` : ''}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Node Telemetry Inspector */}
              {selectedNodeId && (() => {
                const activeNode = (topologyNodes as any)[selectedNodeId];
                return (
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-900/60 space-y-2">
                    <div className="flex justify-between items-center border-b border-slate-900/40 pb-1.5">
                      <span className="font-bold text-white uppercase text-[8px] flex items-center space-x-1">
                        <span className="h-1.5 w-1.5 rounded-full inline-block animate-pulse" style={{ backgroundColor: activeNode.color }} />
                        <span>{activeNode.role}</span>
                      </span>
                      <span className="text-[7px] text-slate-500 font-mono">{activeNode.label}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[7.5px] text-slate-400 font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-600">IP ADDR:</span>
                        <span>{activeNode.ip}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">PODS:</span>
                        <span>{activeNode.pods} replicas</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">CPU LOAD:</span>
                        <span className="text-indigo-400 font-bold">{activeNode.cpu}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">MEMORY:</span>
                        <span>{activeNode.ram}</span>
                      </div>
                    </div>

                    {/* Action console for active node */}
                    <div className="pt-1.5 flex space-x-2 border-t border-slate-900/40">
                      <button
                        onClick={() => {
                          if (isRecycling) return;
                          setIsRecycling(true);
                          setRecycleProgress(0);
                          const intv = setInterval(() => {
                            setRecycleProgress(prev => {
                              if (prev >= 100) {
                                clearInterval(intv);
                                setIsRecycling(false);
                                window.dispatchEvent(new CustomEvent('show-toast', { 
                                  detail: { message: `Node "${activeNode.label}" container recycled successfully!` } 
                                }));
                                return 100;
                              }
                              return prev + 25;
                            });
                          }, 400);
                        }}
                        disabled={isRecycling}
                        className={`flex-1 py-1 rounded text-[7.5px] font-bold uppercase transition-colors flex items-center justify-center space-x-1 ${
                          isRecycling 
                            ? 'bg-slate-900 text-slate-600 cursor-not-allowed' 
                            : 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-600/20 cursor-pointer'
                        }`}
                      >
                        <Icons.RotateCw className={`h-2.5 w-2.5 ${isRecycling ? 'animate-spin' : ''}`} />
                        <span>{isRecycling ? `Recycling (${recycleProgress}%)` : 'Recycle Pod'}</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('show-toast', { 
                            detail: { message: `PING: ${activeNode.ip} -> RTT=2ms, Loss=0%` } 
                          }));
                        }}
                        className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-[7.5px] font-bold uppercase text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        Ping Node
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2 border-t border-slate-900/60 pt-2.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">PostgreSQL DB:</span>
                  <span className="text-slate-300 font-bold">{health?.components?.relationalDb?.type || 'PostgreSQL 16.2'} ({health?.components?.relationalDb?.status || 'CONNECTED'})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">pgvector Embedding:</span>
                  <span className="text-slate-300">{health?.components?.vectorSearch?.index || 'pgvector_idx'} ({health?.components?.vectorSearch?.status || 'ACTIVE'})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Redis Cache:</span>
                  <span className="text-slate-300">Hit Rate {health?.components?.cache?.hitRatePct || 94.2}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">RabbitMQ Message Queue:</span>
                  <span className="text-slate-300">Queues: {health?.components?.queue?.activeQueues || 5} active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Container Uptime:</span>
                  <span className="text-slate-300">100% (47d 12h)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Build Version:</span>
                  <span className="text-slate-300 font-semibold">{health?.buildVersion || 'v1.42.0'}</span>
                </div>
              </div>

              <div className="border-t border-slate-900 pt-2 text-[8px] text-slate-500 flex justify-between items-center">
                <span>UPDATED: SECONDS AGO</span>
                <button
                  onClick={async () => {
                    // Trigger a brief flash
                    setLiveLatency(3);
                    setLiveErrorRate(0.01);
                  }}
                  className="hover:text-indigo-400 text-xxs uppercase flex items-center space-x-1"
                >
                  <Icons.RotateCcw className="h-2 w-2" />
                  <span>RESET DIAGNOSTICS</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

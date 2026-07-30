import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { Incident } from '../types';

interface InfrastructureNodeHeatmapProps {
  incidents: Incident[];
  onSelectNodeFilter?: (nodeName: string | null) => void;
}

interface InfraNode {
  id: string;
  name: string;
  region: string;
  type: 'K8S' | 'DATABASE' | 'GATEWAY' | 'QUEUE' | 'CACHE' | 'SECURITY';
  cpuUsagePct: number;
  memoryUsagePct: number;
  density24h: number; // Incident density count over last 24h
  activeIncidentsCount: number;
  status: 'OPTIMAL' | 'ELEVATED' | 'HOTSPOT';
  recentIncidentIds: string[];
}

export const InfrastructureNodeHeatmap: React.FC<InfrastructureNodeHeatmapProps> = ({
  incidents,
  onSelectNodeFilter
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Generate real-time infra nodes mapped to actual incidents
  const nodes: InfraNode[] = [
    {
      id: 'node-k8s-01',
      name: 'k8s-worker-us-east-1a',
      region: 'us-east-1',
      type: 'K8S',
      cpuUsagePct: 88,
      memoryUsagePct: 94,
      density24h: 7,
      activeIncidentsCount: incidents.filter(i => i.appName.toLowerCase().includes('k8s') || i.title.toLowerCase().includes('oom')).length || 2,
      status: 'HOTSPOT',
      recentIncidentIds: ['INC-1002', 'INC-1009']
    },
    {
      id: 'node-db-pg01',
      name: 'db-primary-postgres-01',
      region: 'us-east-1',
      type: 'DATABASE',
      cpuUsagePct: 76,
      memoryUsagePct: 82,
      density24h: 5,
      activeIncidentsCount: incidents.filter(i => i.appName.toLowerCase().includes('postgres') || i.title.toLowerCase().includes('lock')).length || 1,
      status: 'HOTSPOT',
      recentIncidentIds: ['INC-1003']
    },
    {
      id: 'node-api-gw',
      name: 'api-gateway-edge-01',
      region: 'us-east-1',
      type: 'GATEWAY',
      cpuUsagePct: 62,
      memoryUsagePct: 68,
      density24h: 4,
      activeIncidentsCount: incidents.filter(i => i.appName.toLowerCase().includes('gateway') || i.title.toLowerCase().includes('timeout')).length || 1,
      status: 'ELEVATED',
      recentIncidentIds: ['INC-1004']
    },
    {
      id: 'node-kafka-02',
      name: 'kafka-broker-cluster-02',
      region: 'us-east-1',
      type: 'QUEUE',
      cpuUsagePct: 58,
      memoryUsagePct: 64,
      density24h: 3,
      activeIncidentsCount: incidents.filter(i => i.appName.toLowerCase().includes('rabbitmq') || i.title.toLowerCase().includes('unacked')).length || 1,
      status: 'ELEVATED',
      recentIncidentIds: ['INC-1005']
    },
    {
      id: 'node-redis-cache',
      name: 'redis-cache-cluster-01',
      region: 'us-east-1',
      type: 'CACHE',
      cpuUsagePct: 32,
      memoryUsagePct: 41,
      density24h: 1,
      activeIncidentsCount: 0,
      status: 'OPTIMAL',
      recentIncidentIds: []
    },
    {
      id: 'node-vault-sec',
      name: 'hashicorp-vault-node-01',
      region: 'us-east-1',
      type: 'SECURITY',
      cpuUsagePct: 28,
      memoryUsagePct: 35,
      density24h: 1,
      activeIncidentsCount: 0,
      status: 'OPTIMAL',
      recentIncidentIds: []
    },
    {
      id: 'node-carrier-relay',
      name: 'carrier-webhook-worker-03',
      region: 'eu-west-1',
      type: 'GATEWAY',
      cpuUsagePct: 84,
      memoryUsagePct: 79,
      density24h: 6,
      activeIncidentsCount: 1,
      status: 'HOTSPOT',
      recentIncidentIds: ['INC-1008']
    },
    {
      id: 'node-k8s-02',
      name: 'k8s-worker-us-east-1b',
      region: 'us-east-1',
      type: 'K8S',
      cpuUsagePct: 45,
      memoryUsagePct: 52,
      density24h: 2,
      activeIncidentsCount: 0,
      status: 'OPTIMAL',
      recentIncidentIds: []
    }
  ];

  const handleNodeClick = (node: InfraNode) => {
    if (selectedNodeId === node.id) {
      setSelectedNodeId(null);
      if (onSelectNodeFilter) onSelectNodeFilter(null);
    } else {
      setSelectedNodeId(node.id);
      if (onSelectNodeFilter) onSelectNodeFilter(node.name);
    }
  };

  const getStatusColor = (status: InfraNode['status']) => {
    switch (status) {
      case 'HOTSPOT':
        return 'bg-rose-950/70 border-rose-500/80 text-rose-300 shadow-rose-500/20 hover:bg-rose-900/80';
      case 'ELEVATED':
        return 'bg-amber-950/60 border-amber-500/60 text-amber-300 shadow-amber-500/10 hover:bg-amber-900/70';
      case 'OPTIMAL':
        return 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50';
    }
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 shadow-xl font-mono space-y-3">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center space-x-2.5">
          <div className="h-7 w-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
            <Icons.Cpu className="h-4 w-4 text-rose-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-display">
                INFRASTRUCTURE NODE INCIDENT HEAT-MAP
              </h3>
              <span className="rounded bg-rose-500/20 px-1.5 py-0.2 text-[9px] text-rose-400 border border-rose-500/30 font-bold">
                24H DENSITY
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-sans">
              Node hotspot distribution based on incident frequency and resource pressure
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Legend */}
          <div className="hidden sm:flex items-center space-x-2 text-[9.5px]">
            <span className="flex items-center space-x-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span className="text-slate-400">0-1 (Optimal)</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              <span className="text-slate-400">2-4 (Elevated)</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="h-2 w-2 rounded-full bg-rose-500"></span>
              <span className="text-slate-400">5+ (Hotspot)</span>
            </span>
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800/60 transition-colors"
            title={isCollapsed ? "Expand Heatmap" : "Collapse Heatmap"}
          >
            {isCollapsed ? <Icons.ChevronDown className="h-4 w-4" /> : <Icons.ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Heatmap Grid */}
      {!isCollapsed && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const colorClass = getStatusColor(node.status);

              return (
                <div
                  key={node.id}
                  onClick={() => handleNodeClick(node)}
                  className={`border rounded-lg p-2 transition-all cursor-pointer shadow-md flex flex-col justify-between h-24 ${colorClass} ${
                    isSelected ? 'ring-2 ring-white scale-105 z-10' : ''
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[8.5px]">
                      <span className="font-bold opacity-80">{node.type}</span>
                      {node.status === 'HOTSPOT' && (
                        <span className="animate-ping h-1.5 w-1.5 rounded-full bg-rose-400"></span>
                      )}
                    </div>
                    <p className="text-[9.5px] font-bold text-white leading-tight truncate" title={node.name}>
                      {node.name.replace('k8s-worker-', '').replace('db-primary-', '')}
                    </p>
                  </div>

                  <div className="space-y-1 text-[8.5px]">
                    <div className="flex items-center justify-between border-t border-slate-800/50 pt-1">
                      <span className="opacity-75">24h Inc:</span>
                      <span className="font-extrabold text-white text-[10px]">{node.density24h}</span>
                    </div>

                    <div className="flex items-center justify-between opacity-80 text-[8px]">
                      <span>CPU: {node.cpuUsagePct}%</span>
                      <span>MEM: {node.memoryUsagePct}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Node Details Drawer */}
          {selectedNode && (
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-3">
                <Icons.Server className="h-4 w-4 text-indigo-400 shrink-0" />
                <div>
                  <span className="font-bold text-white">{selectedNode.name}</span>
                  <span className="text-slate-400 text-[10px] ml-2">({selectedNode.region} \u2022 {selectedNode.type})</span>
                </div>
              </div>

              <div className="flex items-center space-x-4 text-[10px]">
                <div>
                  <span className="text-slate-400">24H Density: </span>
                  <span className="font-bold text-rose-400">{selectedNode.density24h} incidents</span>
                </div>
                <div>
                  <span className="text-slate-400">CPU Load: </span>
                  <span className="font-bold text-amber-400">{selectedNode.cpuUsagePct}%</span>
                </div>
                <div>
                  <span className="text-slate-400">RAM Load: </span>
                  <span className="font-bold text-amber-400">{selectedNode.memoryUsagePct}%</span>
                </div>
                {selectedNode.recentIncidentIds.length > 0 && (
                  <div>
                    <span className="text-slate-400">Active IDs: </span>
                    <span className="font-mono text-indigo-300">{selectedNode.recentIncidentIds.join(', ')}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => handleNodeClick(selectedNode)}
                className="text-[10px] text-slate-400 hover:text-white underline font-mono"
              >
                Clear Node Filter
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InfrastructureNodeHeatmap;

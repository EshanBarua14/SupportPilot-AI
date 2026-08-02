import React, { useState, useEffect, useRef } from 'react';
import * as Icons from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Incident } from '../types';
import { getIncidentTags } from './IncidentWorkspace';

interface IncidentCorrelationMapProps {
  incidents: Incident[];
  selectedIncidentId?: string;
  onSelectIncident?: (incident: Incident) => void;
  onClose?: () => void;
}

export interface CorrelationEdge {
  id: string;
  source: Incident;
  target: Incident;
  score: number; // 1 to 5
  sharedTags: string[];
  sharedCluster: string | null;
  commonKeywords: string[];
  reason: string;
}

export const IncidentCorrelationMap: React.FC<IncidentCorrelationMapProps> = ({
  incidents,
  selectedIncidentId,
  onSelectIncident,
  onClose
}) => {
  const [minScoreFilter, setMinScoreFilter] = useState<number>(1);
  const [selectedClusterFilter, setSelectedClusterFilter] = useState<string>('ALL');
  const [activeEdge, setActiveEdge] = useState<CorrelationEdge | null>(null);
  const [activeNode, setActiveNode] = useState<Incident | null>(
    incidents.find(i => i.id === selectedIncidentId) || incidents[0] || null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [layoutMode, setLayoutMode] = useState<'RADIAL' | 'GRID' | 'FORCE'>('RADIAL');

  // Compute pairwise correlation graph
  const computeCorrelationEdges = (): CorrelationEdge[] => {
    const edges: CorrelationEdge[] = [];

    for (let i = 0; i < incidents.length; i++) {
      for (let j = i + 1; j < incidents.length; j++) {
        const incA = incidents[i];
        const incB = incidents[j];

        const tagsA = getIncidentTags(incA);
        const tagsB = getIncidentTags(incB);
        const sharedTags = tagsA.filter(t => tagsB.includes(t));

        // Shared Cluster/Provider
        let sharedCluster: string | null = null;
        if (incA.cloudProvider && incB.cloudProvider && incA.cloudProvider === incB.cloudProvider) {
          sharedCluster = incA.cloudProvider;
        }

        // Keywords in title/description
        const keywords = ['502', 'deadlock', 'oomkilled', 'postgres', 'billing', 'timeout', 'ssl', 'carrier', 'memory', 'auth', 'redis'];
        const textA = (incA.title + ' ' + incA.description).toLowerCase();
        const textB = (incB.title + ' ' + incB.description).toLowerCase();
        const commonKeywords = keywords.filter(kw => textA.includes(kw) && textB.includes(kw));

        // Score calculation
        let score = 0;
        if (sharedTags.length > 0) score += sharedTags.length;
        if (sharedCluster) score += 1;
        if (commonKeywords.length > 0) score += commonKeywords.length;

        if (score > 0) {
          const reasons: string[] = [];
          if (sharedTags.length > 0) reasons.push(`Shared Tags: ${sharedTags.join(', ')}`);
          if (sharedCluster) reasons.push(`Cluster/Cloud: ${sharedCluster}`);
          if (commonKeywords.length > 0) reasons.push(`Keywords: ${commonKeywords.join(', ')}`);

          edges.push({
            id: `edge-${incA.id}-${incB.id}`,
            source: incA,
            target: incB,
            score: Math.min(5, score),
            sharedTags,
            sharedCluster,
            commonKeywords,
            reason: reasons.join(' | ')
          });
        }
      }
    }

    return edges;
  };

  const allEdges = computeCorrelationEdges();
  const filteredEdges = allEdges.filter(e => {
    if (e.score < minScoreFilter) return false;
    if (selectedClusterFilter !== 'ALL' && e.sharedCluster !== selectedClusterFilter) return false;
    return true;
  });

  // Filter nodes matching search
  const visibleIncidents = incidents.filter(inc => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      inc.id.toLowerCase().includes(q) ||
      inc.title.toLowerCase().includes(q) ||
      inc.appName.toLowerCase().includes(q) ||
      inc.severity.toLowerCase().includes(q)
    );
  });

  // Calculate SVG Coordinates for Nodes
  const svgWidth = 800;
  const svgHeight = 520;
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;
  const radius = 200;

  const nodePositions: Record<string, { x: number; y: number }> = {};

  visibleIncidents.forEach((inc, idx) => {
    if (layoutMode === 'RADIAL') {
      const angle = (idx / (visibleIncidents.length || 1)) * 2 * Math.PI - Math.PI / 2;
      nodePositions[inc.id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    } else if (layoutMode === 'GRID') {
      const cols = 4;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      nodePositions[inc.id] = {
        x: 140 + col * 170,
        y: 100 + row * 110
      };
    } else {
      // FORCE / CLUSTER LAYOUT
      const isCritical = inc.severity === 'CRITICAL';
      const angle = (idx / (visibleIncidents.length || 1)) * 2 * Math.PI;
      const dist = isCritical ? 90 : 210;
      nodePositions[inc.id] = {
        x: centerX + dist * Math.cos(angle) + (idx % 2 === 0 ? 15 : -15),
        y: centerY + dist * Math.sin(angle) + (idx % 3 === 0 ? 15 : -15)
      };
    }
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
      case 'P0':
        return { bg: 'bg-rose-500', stroke: '#f43f5e', fill: '#f43f5e', text: 'text-rose-400', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30' };
      case 'HIGH':
      case 'P1':
        return { bg: 'bg-amber-500', stroke: '#f59e0b', fill: '#f59e0b', text: 'text-amber-400', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
      case 'MEDIUM':
      case 'P2':
        return { bg: 'bg-yellow-500', stroke: '#eab308', fill: '#eab308', text: 'text-yellow-400', badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' };
      default:
        return { bg: 'bg-indigo-500', stroke: '#6366f1', fill: '#6366f1', text: 'text-indigo-400', badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' };
    }
  };

  // Connected nodes to currently active node
  const connectedNodeIds = new Set<string>();
  if (activeNode) {
    connectedNodeIds.add(activeNode.id);
    filteredEdges.forEach(e => {
      if (e.source.id === activeNode.id) connectedNodeIds.add(e.target.id);
      if (e.target.id === activeNode.id) connectedNodeIds.add(e.source.id);
    });
  }

  return (
    <div className="rounded-xl border border-indigo-500/30 bg-slate-950/90 p-4 shadow-2xl backdrop-blur-xl space-y-4 font-sans text-xs">
      
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="h-9 w-9 rounded-xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-inner">
            <Icons.GitMerge className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-white font-display uppercase tracking-wider">
                Visual Incident Correlation Map
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-[9px] font-mono text-indigo-400 font-bold">
                {visibleIncidents.length} NODES | {filteredEdges.length} CORRELATIONS
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              Graph topology connecting active incidents based on shared service tags, cluster IDs, and alert patterns.
            </p>
          </div>
        </div>

        {/* View Controls */}
        <div className="flex items-center space-x-2">
          {/* Layout Mode */}
          <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-[10px]">
            <button
              onClick={() => setLayoutMode('RADIAL')}
              className={`px-2 py-1 rounded-md font-bold transition-all cursor-pointer ${
                layoutMode === 'RADIAL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Radial
            </button>
            <button
              onClick={() => setLayoutMode('FORCE')}
              className={`px-2 py-1 rounded-md font-bold transition-all cursor-pointer ${
                layoutMode === 'FORCE' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Cluster
            </button>
            <button
              onClick={() => setLayoutMode('GRID')}
              className={`px-2 py-1 rounded-md font-bold transition-all cursor-pointer ${
                layoutMode === 'GRID' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Grid
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <Icons.X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Options Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 font-mono text-[10px]">
        {/* Min Score Threshold */}
        <div className="flex items-center space-x-2">
          <span className="text-slate-400 uppercase font-bold flex items-center space-x-1">
            <Icons.Filter className="h-3 w-3 text-indigo-400" />
            <span>Min Correlation:</span>
          </span>
          <div className="flex items-center space-x-1">
            {[1, 2, 3, 4].map(score => (
              <button
                key={score}
                onClick={() => setMinScoreFilter(score)}
                className={`px-2 py-0.5 rounded border transition-all cursor-pointer ${
                  minScoreFilter === score
                    ? 'bg-indigo-600 text-white border-indigo-500 font-bold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                ≥ {score} {score === 1 ? 'Trait' : 'Traits'}
              </button>
            ))}
          </div>
        </div>

        {/* Search Nodes */}
        <div className="relative w-48">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search nodes or tags..."
            className="w-full rounded-lg bg-slate-950 border border-slate-800 pl-7 pr-2 py-1 text-[10px] text-white focus:outline-none focus:border-indigo-500"
          />
          <Icons.Search className="absolute left-2 top-1.5 h-3 w-3 text-slate-500" />
        </div>
      </div>

      {/* Main SVG Visualization & Sidebar Details */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* SVG Interactive Canvas */}
        <div className="col-span-12 lg:col-span-8 relative rounded-xl border border-slate-800/90 bg-slate-950 p-2 overflow-hidden flex items-center justify-center min-h-[460px]">
          {/* Subtle Grid Background Lines */}
          <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />

          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto max-h-[500px] select-none"
          >
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Draw Correlation Edges */}
            {filteredEdges.map(edge => {
              const posA = nodePositions[edge.source.id];
              const posB = nodePositions[edge.target.id];
              if (!posA || !posB) return null;

              const isConnectedToActive = activeNode && (edge.source.id === activeNode.id || edge.target.id === activeNode.id);
              const strokeWidth = Math.max(1.5, edge.score * 1.2);
              const strokeColor = isConnectedToActive ? '#a855f7' : '#475569';
              const opacity = isConnectedToActive ? 0.95 : 0.35;

              return (
                <g key={edge.id} className="transition-all duration-300">
                  <line
                    x1={posA.x}
                    y1={posA.y}
                    x2={posB.x}
                    y2={posB.y}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeOpacity={opacity}
                    strokeDasharray={edge.score >= 3 ? '4 2' : 'none'}
                    className="cursor-pointer hover:stroke-indigo-400"
                    onClick={() => {
                      setActiveEdge(edge);
                      setActiveNode(edge.source);
                    }}
                  />
                  {/* Midpoint Score Badge */}
                  {isConnectedToActive && (
                    <g transform={`translate(${(posA.x + posB.x) / 2}, ${(posA.y + posB.y) / 2})`}>
                      <circle r="9" fill="#0f172a" stroke="#a855f7" strokeWidth="1.5" />
                      <text
                        textAnchor="middle"
                        dy="3"
                        fill="#e2e8f0"
                        fontSize="8"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {edge.score}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Draw Incident Nodes */}
            {visibleIncidents.map(inc => {
              const pos = nodePositions[inc.id];
              if (!pos) return null;

              const isSelected = activeNode?.id === inc.id;
              const isConnected = connectedNodeIds.has(inc.id);
              const colorInfo = getSeverityColor(inc.severity);
              const isCritical = inc.severity === 'CRITICAL';
              const radiusSize = isCritical ? 20 : 16;

              return (
                <g
                  key={inc.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  className="cursor-pointer transition-transform duration-200 hover:scale-110"
                  onClick={() => {
                    setActiveNode(inc);
                    if (onSelectIncident) onSelectIncident(inc);
                  }}
                >
                  {/* Pulsing Outer Aura for Selected/Critical */}
                  {(isSelected || isCritical) && (
                    <circle
                      r={radiusSize + 8}
                      fill={colorInfo.fill}
                      fillOpacity={isSelected ? 0.25 : 0.1}
                      className="animate-ping"
                    />
                  )}

                  {/* Node Base Circle */}
                  <circle
                    r={radiusSize}
                    fill="#0f172a"
                    stroke={isSelected ? '#a855f7' : isConnected ? colorInfo.stroke : '#334155'}
                    strokeWidth={isSelected ? 3 : isConnected ? 2 : 1}
                    filter={isSelected ? 'url(#glow)' : undefined}
                  />

                  {/* Inner Severity Indicator Ring */}
                  <circle
                    r={radiusSize - 5}
                    fill={colorInfo.fill}
                    fillOpacity={0.8}
                  />

                  {/* ID / Name Tag Text */}
                  <text
                    textAnchor="middle"
                    dy="3"
                    fill="#ffffff"
                    fontSize={isCritical ? '9' : '8'}
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {inc.id.split('-')[1] || inc.id.slice(-3)}
                  </text>

                  {/* Label below node */}
                  <text
                    textAnchor="middle"
                    dy={radiusSize + 14}
                    fill={isSelected ? '#ffffff' : '#94a3b8'}
                    fontSize="9"
                    fontFamily="sans-serif"
                    fontWeight={isSelected ? 'bold' : 'normal'}
                  >
                    {inc.appName.length > 14 ? inc.appName.slice(0, 12) + '...' : inc.appName}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Interactive Legend Box Overlay */}
          <div className="absolute bottom-2 left-2 bg-slate-900/90 border border-slate-800 rounded-lg p-2 font-mono text-[8px] space-y-1 text-slate-400">
            <div className="font-bold text-white uppercase">Topology Key:</div>
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span>CRITICAL (P0)</span>
              <span className="h-2 w-2 rounded-full bg-amber-500 ml-2" />
              <span>HIGH (P1)</span>
              <span className="h-2 w-2 rounded-full bg-indigo-500 ml-2" />
              <span>MEDIUM/LOW</span>
            </div>
            <div className="text-[7.5px] text-slate-500 pt-0.5">
              Click node to expand correlation matrix. Dashed line = high similarity.
            </div>
          </div>
        </div>

        {/* Selected Incident Node & Linked Neighbors Panel */}
        <div className="col-span-12 lg:col-span-4 space-y-3">
          {activeNode ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-[9px] font-mono font-bold text-indigo-400 uppercase tracking-wider">
                  Node Context Inspector
                </span>
                <span className={`px-2 py-0.5 rounded border text-[9px] font-mono font-bold ${getSeverityColor(activeNode.severity).badge}`}>
                  {activeNode.severity}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-xs text-white leading-snug">{activeNode.title}</h3>
                <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{activeNode.description}</p>
              </div>

              {/* Tags List */}
              <div className="space-y-1">
                <div className="text-[9px] font-mono text-slate-500 uppercase">Extracted Service Tags:</div>
                <div className="flex flex-wrap gap-1">
                  {getIncidentTags(activeNode).map(tag => (
                    <span key={tag} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[9px] font-mono border border-slate-700">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Correlated Cluster Neighbors */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="text-[9px] font-mono font-bold text-slate-300 uppercase flex items-center justify-between">
                  <span>Linked Correlated Incidents</span>
                  <span className="text-indigo-400">
                    {filteredEdges.filter(e => e.source.id === activeNode.id || e.target.id === activeNode.id).length} Connected
                  </span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {filteredEdges
                    .filter(e => e.source.id === activeNode.id || e.target.id === activeNode.id)
                    .map(edge => {
                      const other = edge.source.id === activeNode.id ? edge.target : edge.source;
                      return (
                        <button
                          key={edge.id}
                          onClick={() => {
                            setActiveNode(other);
                            setActiveEdge(edge);
                            if (onSelectIncident) onSelectIncident(other);
                          }}
                          className="w-full text-left p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500/50 transition-all cursor-pointer group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[10px] text-indigo-300 group-hover:text-white truncate">
                              {other.id}: {other.appName}
                            </span>
                            <span className="text-[8.5px] font-mono text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded">
                              Score: {edge.score}/5
                            </span>
                          </div>
                          <div className="text-[8.5px] text-slate-400 font-mono mt-1 line-clamp-1">
                            {edge.reason}
                          </div>
                        </button>
                      );
                    })}

                  {filteredEdges.filter(e => e.source.id === activeNode.id || e.target.id === activeNode.id).length === 0 && (
                    <div className="text-[10px] text-slate-500 font-mono p-3 text-center bg-slate-950 rounded-lg border border-slate-900">
                      No correlated neighbors matching current score threshold.
                    </div>
                  )}
                </div>
              </div>

              {onSelectIncident && (
                <button
                  onClick={() => onSelectIncident(activeNode)}
                  className="w-full flex items-center justify-center space-x-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 text-xs transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                  <span>Focus in Workspace Triage</span>
                  <Icons.ExternalLink className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 text-center text-slate-500 font-mono text-xs">
              Click any node in the SVG graph to inspect its service correlations.
            </div>
          )}
        </div>

      </div>

    </div>
  );
};

export default IncidentCorrelationMap;

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as Icons from 'lucide-react';
import { Incident } from '../types';

interface IncidentD3MapProps {
  incident: Incident;
}

interface NodeData extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  tier: 'Gateway' | 'Microservice' | 'Database' | 'Cache' | 'External';
  status: 'CRITICAL_OUTAGE' | 'DEGRADED' | 'HEALTHY';
  rps: number;
  latencyMs: number;
  errorRate: string;
  details: string;
}

interface LinkData extends d3.SimulationLinkDatum<NodeData> {
  source: string | NodeData;
  target: string | NodeData;
  trafficType: string;
  status: 'DEGRADED' | 'NORMAL';
}

export const IncidentD3Map: React.FC<IncidentD3MapProps> = ({ incident }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [layoutMode, setLayoutMode] = useState<'FORCE' | 'HIERARCHICAL'>('FORCE');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'CRITICAL' | 'DEGRADED'>('ALL');

  // Build topology dataset derived from active incident
  const getTopologyData = () => {
    const isBilling = incident.appName.toLowerCase().includes('billing');
    const isCarrier = incident.appName.toLowerCase().includes('carrier') || incident.appName.toLowerCase().includes('webhook');
    const isAuth = incident.appName.toLowerCase().includes('auth');

    const nodes: NodeData[] = [
      {
        id: 'ingress-nginx',
        name: 'Ingress Nginx Gateway',
        tier: 'Gateway',
        status: 'DEGRADED',
        rps: 1420,
        latencyMs: 145,
        errorRate: '12.4%',
        details: 'Nginx reverse proxy routing external REST/gRPC payloads.'
      },
      {
        id: 'auth-service',
        name: 'Auth Token Service',
        tier: 'Microservice',
        status: isAuth ? 'CRITICAL_OUTAGE' : 'HEALTHY',
        rps: 450,
        latencyMs: 35,
        errorRate: isAuth ? '45.1%' : '0.1%',
        details: 'OAuth2 & JWT validation cluster for enterprise tenants.'
      },
      {
        id: 'billing-core',
        name: 'Billing & Subscriptions Core',
        tier: 'Microservice',
        status: isBilling ? 'CRITICAL_OUTAGE' : 'HEALTHY',
        rps: 380,
        latencyMs: isBilling ? 3420 : 65,
        errorRate: isBilling ? '88.5%' : '0.2%',
        details: 'Subscription ledger & invoice payment processor.'
      },
      {
        id: 'carrier-relay',
        name: 'Carrier Webhook Relay',
        tier: 'External',
        status: isCarrier ? 'CRITICAL_OUTAGE' : 'HEALTHY',
        rps: 210,
        latencyMs: isCarrier ? 5200 : 80,
        errorRate: isCarrier ? '72.0%' : '0.0%',
        details: 'External shipping carrier webhooks API broker.'
      },
      {
        id: 'postgres-primary',
        name: 'PostgreSQL DB Primary',
        tier: 'Database',
        status: 'DEGRADED',
        rps: 2800,
        latencyMs: 420,
        errorRate: '15.2%',
        details: 'Relational DB cluster with active row lock congestion.'
      },
      {
        id: 'redis-cache',
        name: 'Redis L2 Session Cache',
        tier: 'Cache',
        status: 'HEALTHY',
        rps: 5400,
        latencyMs: 2,
        errorRate: '0.0%',
        details: 'In-memory distributed key-value store.'
      },
      {
        id: 'k8s-pod-replica',
        name: 'K8s Worker Pods (Replica 4)',
        tier: 'Microservice',
        status: incident.severity === 'CRITICAL' ? 'CRITICAL_OUTAGE' : 'DEGRADED',
        rps: 890,
        latencyMs: 890,
        errorRate: '28.4%',
        details: 'Container pod replica set managed by ArgoCD.'
      }
    ];

    const links: LinkData[] = [
      { source: 'ingress-nginx', target: 'auth-service', trafficType: 'HTTPS/REST', status: isAuth ? 'DEGRADED' : 'NORMAL' },
      { source: 'ingress-nginx', target: 'billing-core', trafficType: 'gRPC', status: isBilling ? 'DEGRADED' : 'NORMAL' },
      { source: 'ingress-nginx', target: 'carrier-relay', trafficType: 'Webhook HTTP', status: isCarrier ? 'DEGRADED' : 'NORMAL' },
      { source: 'billing-core', target: 'postgres-primary', trafficType: 'TCP / Port 5432', status: 'DEGRADED' },
      { source: 'auth-service', target: 'redis-cache', trafficType: 'TCP / Port 6379', status: 'NORMAL' },
      { source: 'billing-core', target: 'k8s-pod-replica', trafficType: 'Internal Mesh', status: 'DEGRADED' }
    ];

    return { nodes, links };
  };

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 700;
    const height = 440;

    // Clear previous SVG contents
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const { nodes, links } = getTopologyData();

    // Filter nodes if requested
    const filteredNodes = nodes.filter(n => {
      if (filterStatus === 'CRITICAL') return n.status === 'CRITICAL_OUTAGE';
      if (filterStatus === 'DEGRADED') return n.status === 'DEGRADED' || n.status === 'CRITICAL_OUTAGE';
      return true;
    });

    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = links.filter(l => {
      const srcId = typeof l.source === 'string' ? l.source : (l.source as NodeData).id;
      const tgtId = typeof l.target === 'string' ? l.target : (l.target as NodeData).id;
      return nodeIds.has(srcId) && nodeIds.has(tgtId);
    });

    // Add SVG style element for node pulse animations
    const defs = svg.append('defs');
    defs.append('style').text(`
      @keyframes pulseCriticalRing {
        0% { r: 22px; opacity: 0.9; stroke-width: 3px; }
        50% { r: 38px; opacity: 0.15; stroke-width: 5px; }
        100% { r: 22px; opacity: 0.9; stroke-width: 3px; }
      }
      @keyframes pulseDegradedRing {
        0% { r: 20px; opacity: 0.7; stroke-width: 2px; }
        50% { r: 32px; opacity: 0.2; stroke-width: 3.5px; }
        100% { r: 20px; opacity: 0.7; stroke-width: 2px; }
      }
      @keyframes pulseHealthyRing {
        0% { r: 18px; opacity: 0.4; }
        50% { r: 24px; opacity: 0.05; }
        100% { r: 18px; opacity: 0.4; }
      }
      .pulse-critical { animation: pulseCriticalRing 1.4s infinite ease-in-out; }
      .pulse-degraded { animation: pulseDegradedRing 2.0s infinite ease-in-out; }
      .pulse-healthy { animation: pulseHealthyRing 3.2s infinite ease-in-out; }
    `);

    // Main Group with Zoom
    const g = svg.append('g').attr('class', 'main-group');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom as any);

    // Setup Force Simulation
    const simulation = d3.forceSimulation<NodeData>(filteredNodes)
      .force('link', d3.forceLink<NodeData, LinkData>(filteredLinks).id((d) => d.id).distance(110))
      .force('charge', d3.forceManyBody().strength(-350))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(45));

    // Render Links
    const linkGroup = g.append('g').attr('class', 'links');

    const link = linkGroup.selectAll('line')
      .data(filteredLinks)
      .enter()
      .append('line')
      .attr('stroke', (d) => d.status === 'DEGRADED' ? '#ef4444' : '#334155')
      .attr('stroke-width', (d) => d.status === 'DEGRADED' ? 2.5 : 1.5)
      .attr('stroke-dasharray', (d) => d.status === 'DEGRADED' ? '4,4' : 'none');

    // Link Labels
    const linkText = g.append('g').selectAll('text')
      .data(filteredLinks)
      .enter()
      .append('text')
      .text(d => d.trafficType)
      .attr('font-size', '8px')
      .attr('font-family', 'monospace')
      .attr('fill', '#64748b')
      .attr('text-anchor', 'middle');

    // Render Nodes Group
    const nodeGroup = g.append('g').attr('class', 'nodes');

    const node = nodeGroup.selectAll<SVGGElement, NodeData>('g')
      .data(filteredNodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        setSelectedNode(d);
      })
      .call(
        d3.drag<SVGGElement, NodeData>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Node Outer Glow Ring with Live Pulse Animation
    node.append('circle')
      .attr('r', 24)
      .attr('class', d => {
        if (d.status === 'CRITICAL_OUTAGE') return 'pulse-critical';
        if (d.status === 'DEGRADED') return 'pulse-degraded';
        return 'pulse-healthy';
      })
      .attr('fill', d => {
        if (d.status === 'CRITICAL_OUTAGE') return '#9f1239';
        if (d.status === 'DEGRADED') return '#78350f';
        return '#064e3b';
      })
      .attr('opacity', 0.25)
      .attr('stroke', d => {
        if (d.status === 'CRITICAL_OUTAGE') return '#ef4444';
        if (d.status === 'DEGRADED') return '#f59e0b';
        return '#10b981';
      })
      .attr('stroke-width', 2);

    // Node Core Circle
    node.append('circle')
      .attr('r', 16)
      .attr('fill', d => {
        if (d.status === 'CRITICAL_OUTAGE') return '#ef4444';
        if (d.status === 'DEGRADED') return '#f59e0b';
        return '#10b981';
      });

    // Node Tier Badge Text inside Circle
    node.append('text')
      .text(d => d.tier[0])
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('fill', '#020617')
      .attr('font-weight', 'bold')
      .attr('font-size', '11px')
      .attr('font-family', 'monospace');

    // Node Name Label underneath
    node.append('text')
      .text(d => d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', 36)
      .attr('fill', '#f8fafc')
      .attr('font-size', '9.5px')
      .attr('font-weight', 'bold')
      .attr('font-family', 'sans-serif');

    // Node Metric Subtitle
    node.append('text')
      .text(d => `${d.rps} RPS • ${d.latencyMs}ms`)
      .attr('text-anchor', 'middle')
      .attr('dy', 48)
      .attr('fill', d => d.status === 'CRITICAL_OUTAGE' ? '#fca5a5' : '#94a3b8')
      .attr('font-size', '8px')
      .attr('font-family', 'monospace');

    // Simulation Tick Listener
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as NodeData).x!)
        .attr('y1', d => (d.source as NodeData).y!)
        .attr('x2', d => (d.target as NodeData).x!)
        .attr('y2', d => (d.target as NodeData).y!);

      linkText
        .attr('x', d => ((d.source as NodeData).x! + (d.target as NodeData).x!) / 2)
        .attr('y', d => ((d.source as NodeData).y! + (d.target as NodeData).y!) / 2 - 4);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [incident, filterStatus]);

  return (
    <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 shadow-xl font-mono space-y-3 relative overflow-hidden">
      {/* Topology Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <Icons.Network className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <h3 className="font-display font-bold text-xs text-white uppercase tracking-wider flex items-center space-x-2">
              <span>D3 Interactive Infrastructure Topology Map</span>
              <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[8px] border border-rose-500/20">
                ACTIVE INCIDENT GRAPH
              </span>
            </h3>
            <p className="text-[9.5px] text-slate-400">Drag nodes to inspect dependency flows & failure propagation</p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center space-x-2">
          <span className="text-xxs text-slate-500">Filter Status:</span>
          {['ALL', 'CRITICAL', 'DEGRADED'].map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st as any)}
              className={`px-2 py-0.5 rounded text-[8.5px] font-bold uppercase transition-all cursor-pointer ${
                filterStatus === st
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Canvas & Node Inspector split */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 relative">
        <div ref={containerRef} className="lg:col-span-3 bg-slate-900/60 border border-slate-800/80 rounded-xl relative min-h-[440px] overflow-hidden">
          {/* Helper overlay instruction */}
          <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded bg-slate-950/80 border border-slate-800 text-[8.5px] text-slate-400 flex items-center space-x-1">
            <Icons.MousePointer className="h-2.5 w-2.5 text-indigo-400" />
            <span>Click node to view metrics • Drag to reposition • Scroll to zoom</span>
          </div>

          <svg ref={svgRef} className="w-full h-full min-h-[440px]" />
        </div>

        {/* Node Inspector Panel */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-3 font-sans">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="font-mono font-bold text-xxs text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Icons.Cpu className="h-3.5 w-3.5 text-indigo-400" />
              <span>Node Inspector</span>
            </h4>
            {selectedNode && (
              <button
                onClick={() => setSelectedNode(null)}
                className="text-slate-500 hover:text-white text-xxs font-mono"
              >
                Clear
              </button>
            )}
          </div>

          {selectedNode ? (
            <div className="space-y-2.5 text-xxs">
              <div className="space-y-1">
                <div className="font-bold text-white text-xs font-mono">{selectedNode.name}</div>
                <div className="flex items-center space-x-2 font-mono">
                  <span className="text-slate-400">Tier: {selectedNode.tier}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                    selectedNode.status === 'CRITICAL_OUTAGE'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : selectedNode.status === 'DEGRADED'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {selectedNode.status}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono space-y-1.5 text-[9.5px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Throughput:</span>
                  <span className="text-white font-bold">{selectedNode.rps} req/sec</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">P99 Latency:</span>
                  <span className={`font-bold ${selectedNode.latencyMs > 500 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {selectedNode.latencyMs} ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Error Ratio:</span>
                  <span className={`font-bold ${selectedNode.errorRate !== '0.0%' ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {selectedNode.errorRate}
                  </span>
                </div>
              </div>

              <p className="text-slate-300 leading-relaxed font-sans text-[10px] bg-slate-950/60 border border-slate-800/60 p-2 rounded">
                {selectedNode.details}
              </p>

              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('show-toast', {
                    detail: { message: `Simulated Pod Restart command issued for ${selectedNode.name}!` }
                  }));
                }}
                className="w-full py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-[9px] uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center space-x-1"
              >
                <Icons.RefreshCw className="h-3 w-3" />
                <span>Restart Node Container</span>
              </button>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xxs font-mono space-y-2">
              <Icons.MousePointer className="h-6 w-6 text-slate-600 mx-auto animate-pulse" />
              <p>Click any node in the topology map to view service metrics & health breakdown.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

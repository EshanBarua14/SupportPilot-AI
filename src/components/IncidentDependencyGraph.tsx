import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Incident } from '../types';
import * as Icons from 'lucide-react';

interface DependencyNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: 'client' | 'gateway' | 'service' | 'database' | 'cache' | 'queue' | 'external';
  status: 'healthy' | 'degraded' | 'failed';
  metrics?: string;
}

interface DependencyLink extends d3.SimulationLinkDatum<DependencyNode> {
  source: string | DependencyNode;
  target: string | DependencyNode;
  status: 'normal' | 'congested' | 'failed';
  latency?: string;
}

interface IncidentDependencyGraphProps {
  selectedIncident: Incident;
}

export default function IncidentDependencyGraph({ selectedIncident }: IncidentDependencyGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectedNode, setSelectedNode] = useState<DependencyNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 500, height: 320 });
  const [traceBlastRadius, setTraceBlastRadius] = useState(false);

  // Handle auto-resizing based on parent container
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width } = entries[0].contentRect;
      setDimensions({
        width: Math.max(width, 400),
        height: 320
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    // Clear previous SVG content
    d3.select(svgRef.current).selectAll('*').remove();

    // 1. Generate dynamic Nodes and Links based on the active incident properties
    const appName = selectedIncident.appName || 'Billing Core';
    const isSolved = selectedIncident.status === 'SOLVED';

    const nodes: DependencyNode[] = [
      { id: 'client', label: 'User Traffic', type: 'client', status: 'healthy', metrics: 'RPS: 450' },
      { id: 'gateway', label: 'Ingress Gateway', type: 'gateway', status: isSolved ? 'healthy' : 'healthy', metrics: 'Errors: 0.1%' },
      { id: 'app', label: appName, type: 'service', status: isSolved ? 'healthy' : 'failed', metrics: isSolved ? 'RPS: 320' : '502 Bad Gateway' },
      { id: 'db', label: 'PostgreSQL Cluster', type: 'database', status: isSolved ? 'healthy' : 'degraded', metrics: isSolved ? 'Active: 42' : 'Deadlocks Active' },
      { id: 'cache', label: 'Redis Cache Pool', type: 'cache', status: 'healthy', metrics: 'Hit Rate: 94%' },
      { id: 'queue', label: 'Kafka Stream Broker', type: 'queue', status: 'healthy', metrics: 'Lag: 120 msg' },
      { id: 'external', label: 'Third-Party Handshakes', type: 'external', status: isSolved ? 'healthy' : 'failed', metrics: isSolved ? 'Success: 100%' : 'Timeouts Active' }
    ];

    // Adjust statuses depending on description details
    const descLower = selectedIncident.description.toLowerCase();
    if (descLower.includes('database') || descLower.includes('postgres') || descLower.includes('lock')) {
      const dbNode = nodes.find(n => n.id === 'db');
      if (dbNode && !isSolved) {
        dbNode.status = 'failed';
        dbNode.metrics = 'Locks Exceeded!';
      }
    }
    if (descLower.includes('redis') || descLower.includes('cache')) {
      const cacheNode = nodes.find(n => n.id === 'cache');
      if (cacheNode && !isSolved) {
        cacheNode.status = 'failed';
        cacheNode.metrics = 'Connection Timeout';
      }
    }
    if (descLower.includes('kafka') || descLower.includes('queue') || descLower.includes('lag')) {
      const queueNode = nodes.find(n => n.id === 'queue');
      if (queueNode && !isSolved) {
        queueNode.status = 'failed';
        queueNode.metrics = 'Lagging >5000 msg';
      }
    }

    const links: DependencyLink[] = [
      { source: 'client', target: 'gateway', status: 'normal', latency: '4ms' },
      { source: 'gateway', target: 'app', status: isSolved ? 'normal' : 'failed', latency: isSolved ? '15ms' : 'Timeout' },
      { source: 'app', target: 'db', status: isSolved ? 'normal' : 'congested', latency: isSolved ? '45ms' : '820ms' },
      { source: 'app', target: 'cache', status: 'normal', latency: '2ms' },
      { source: 'app', target: 'queue', status: 'normal', latency: '8ms' },
      { source: 'app', target: 'external', status: isSolved ? 'normal' : 'failed', latency: isSolved ? '120ms' : '9000ms' }
    ];

    const { width, height } = dimensions;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Create a container group for zooming/panning
    const g = svg.append('g');

    // Create the forces
    const simulation = d3.forceSimulation<DependencyNode>(nodes)
      .force('link', d3.forceLink<DependencyNode, DependencyLink>(links)
        .id(d => d.id)
        .distance(110)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40));

    // Define marker symbols for path direction arrows
    svg.append('defs').selectAll('marker')
      .data(['normal', 'congested', 'failed'])
      .enter().append('marker')
      .attr('id', d => `arrow-${d}`)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 26) // Distance from node center
      .attr('refY', 0)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L8,0L0,4')
      .attr('fill', d => {
        if (d === 'failed') return '#ef4444';
        if (d === 'congested') return '#f59e0b';
        return '#475569';
      });

    // 2. Draw Links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke-width', d => {
        if (traceBlastRadius && (d.source === 'app' || d.target === 'app' || d.status === 'failed' || d.status === 'congested')) {
          return 3.0;
        }
        return d.status === 'normal' ? 1.5 : 2.5;
      })
      .attr('stroke', d => {
        if (traceBlastRadius && (d.source === 'app' || d.target === 'app' || d.status === 'failed' || d.status === 'congested')) {
          return '#fca5a5'; // Bright glowing red-pink for blast propagation path
        }
        if (d.status === 'failed') return '#ef4444';
        if (d.status === 'congested') return '#f59e0b';
        return '#334155';
      })
      .attr('stroke-dasharray', d => {
        if (traceBlastRadius && (d.source === 'app' || d.target === 'app' || d.status === 'failed' || d.status === 'congested')) {
          return '6, 4';
        }
        if (d.status === 'failed') return '4, 4';
        if (d.status === 'congested') return '5, 3';
        return 'none';
      })
      .attr('class', d => {
        if (traceBlastRadius && (d.source === 'app' || d.target === 'app' || d.status === 'failed' || d.status === 'congested')) {
          return 'animate-blast-link';
        }
        return '';
      })
      .attr('marker-end', d => `url(#arrow-${d.status})`);

    // 3. Draw Link Labels (Latency)
    const linkText = g.append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(links)
      .enter().append('text')
      .attr('font-family', 'monospace')
      .attr('font-size', '8px')
      .attr('fill', d => {
        if (d.status === 'failed') return '#f87171';
        if (d.status === 'congested') return '#fbbf24';
        return '#64748b';
      })
      .attr('text-anchor', 'middle')
      .text(d => d.latency || '');

    // 4. Draw Node Groups
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .attr('cursor', 'grab')
      .on('click', (event, d) => {
        setSelectedNode(d);
        event.stopPropagation();
      })
      .call(d3.drag<SVGGElement, DependencyNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
      );

    // Node Backdrop pulsing circle for degraded or failed nodes
    node.filter(d => d.status !== 'healthy' || (traceBlastRadius && (d.id === 'gateway' || d.id === 'client')))
      .append('circle')
      .attr('r', d => d.id === 'app' ? 26 : 20)
      .attr('fill', d => {
        if (d.status === 'failed') return '#ef4444';
        if (d.status === 'degraded') return '#f59e0b';
        return '#ef4444'; // Red blast wave for affected gateway/client
      })
      .attr('opacity', 0.25)
      .attr('class', 'animate-ping')
      .style('animation-duration', '1.6s');

    // Node Core Base Circle
    node.append('circle')
      .attr('r', 16)
      .attr('fill', d => {
        if (d.status === 'failed') return '#7f1d1d';
        if (d.status === 'degraded') return '#78350f';
        return '#0f172a';
      })
      .attr('stroke', d => {
        if (d.status === 'failed') return '#ef4444';
        if (d.status === 'degraded') return '#f59e0b';
        return '#10b981';
      })
      .attr('stroke-width', 2);

    // Render node icons (using standard emoji/unicode visual glyph representation for bulletproof cross-compatibility)
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '.3em')
      .attr('font-size', '10px')
      .text(d => {
        switch (d.type) {
          case 'client': return '👥';
          case 'gateway': return '🛡️';
          case 'service': return '⚙️';
          case 'database': return '🗄️';
          case 'cache': return '⚡';
          case 'queue': return '📨';
          case 'external': return '☁️';
          default: return '📦';
        }
      });

    // Node Labels
    node.append('text')
      .attr('dy', 28)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'sans-serif')
      .attr('font-size', '9px')
      .attr('font-weight', 'bold')
      .attr('fill', '#f1f5f9')
      .text(d => d.label);

    // Node Metrics Subtext
    node.append('text')
      .attr('dy', 38)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'monospace')
      .attr('font-size', '7.5px')
      .attr('fill', d => {
        if (d.status === 'failed') return '#fca5a5';
        if (d.status === 'degraded') return '#fde047';
        return '#64748b';
      })
      .text(d => d.metrics || '');

    // Force simulation ticker
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as DependencyNode).x || 0)
        .attr('y1', d => (d.source as DependencyNode).y || 0)
        .attr('x2', d => (d.target as DependencyNode).x || 0)
        .attr('y2', d => (d.target as DependencyNode).y || 0);

      linkText
        .attr('x', d => {
          const s = d.source as DependencyNode;
          const t = d.target as DependencyNode;
          return ((s.x || 0) + (t.x || 0)) / 2;
        })
        .attr('y', d => {
          const s = d.source as DependencyNode;
          const t = d.target as DependencyNode;
          return ((s.y || 0) + (t.y || 0)) / 2 - 5;
        });

      node.attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`);
    });

    // Drag helper callbacks
    function dragstarted(event: any, d: DependencyNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: DependencyNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: DependencyNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Dismiss node detail on SVG click
    svg.on('click', () => setSelectedNode(null));

    return () => {
      simulation.stop();
    };
  }, [selectedIncident, dimensions, traceBlastRadius]);

  return (
    <div ref={containerRef} className="w-full relative bg-slate-950/60 rounded-xl border border-slate-900 p-2 overflow-hidden">
      <style>{`
        @keyframes dashflow {
          to {
            stroke-dashoffset: -20;
          }
        }
        .animate-blast-link {
          animation: dashflow 0.8s linear infinite !important;
        }
      `}</style>

      {/* Topology Toolbar */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center space-x-2 bg-slate-950/90 border border-slate-800 rounded-lg p-1.5 pointer-events-auto shadow-lg">
          <Icons.GitPullRequest className="h-3.5 w-3.5 text-indigo-400" />
          <span className="font-mono text-[9px] font-bold text-slate-300 uppercase tracking-wider">Dependency Topology</span>
        </div>

        <button
          onClick={() => setTraceBlastRadius(!traceBlastRadius)}
          className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border font-mono text-[9px] font-bold cursor-pointer shadow-lg transition-all pointer-events-auto ${
            traceBlastRadius
              ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 animate-pulse'
              : 'bg-slate-950/90 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title="Highlight incident blast radius propagation paths"
        >
          <Icons.ShieldAlert className="h-3 w-3" />
          <span>{traceBlastRadius ? 'BLAST RADIUS ACTIVE' : 'TRACE BLAST RADIUS'}</span>
        </button>
      </div>

      {/* Interactive Canvas */}
      <svg ref={svgRef} className="mx-auto block select-none bg-slate-950/20 pt-8" />

      {/* Selected Node Details HUD / Blast Radius Panel */}
      {selectedNode ? (
        <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-slate-950/90 border border-slate-800 rounded-lg p-2.5 font-mono text-xxs shadow-2xl flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center space-x-1.5">
              <span className="text-white font-bold">{selectedNode.label}</span>
              <span className={`px-1 rounded text-[7px] font-extrabold uppercase ${
                selectedNode.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                selectedNode.status === 'degraded' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {selectedNode.status}
              </span>
            </div>
            <div className="text-slate-400 text-[8px]">
              System Type: <span className="text-indigo-300 font-bold uppercase">{selectedNode.type}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-slate-500 text-[7px] block uppercase">Live Telemetry</span>
            <span className="text-white font-bold text-[9.5px]">{selectedNode.metrics || 'Status Nominal'}</span>
          </div>
        </div>
      ) : traceBlastRadius ? (
        <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-rose-950/90 border border-rose-500/30 rounded-lg p-2.5 font-mono text-xxs shadow-2xl flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center space-x-1.5">
              <span className="text-rose-200 font-bold uppercase tracking-wider flex items-center gap-1">
                <Icons.AlertTriangle className="h-3 w-3 text-rose-400 animate-pulse" />
                <span>Blast Propagation Analysis</span>
              </span>
              <span className="px-1 rounded text-[7px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30">HIGH PROPAGATION RISK</span>
            </div>
            <div className="text-slate-300 text-[8.5px] font-sans leading-relaxed mt-0.5">
              Trigger: <span className="text-white font-bold">{selectedIncident.appName}</span> failure. Downstream propagation is impacting <span className="text-rose-300 font-bold">Ingress Gateway</span> & <span className="text-amber-300 font-semibold">PostgreSQL</span> transactions.
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-rose-400 text-[7px] block uppercase font-bold">Blast Index</span>
            <span className="text-white font-bold text-xs">82%</span>
          </div>
        </div>
      ) : (
        <div className="absolute bottom-2 left-2 text-[8px] font-mono text-slate-500 pointer-events-none uppercase tracking-wider">
          💡 Click and drag nodes to adjust structural physics. Click a node to inspect telemetry.
        </div>
      )}
    </div>
  );
}

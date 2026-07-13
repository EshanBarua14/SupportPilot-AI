import React from 'react';
import { SimulatedMetricsDashboard } from '../data/simulation';
import * as Icons from 'lucide-react';

export default function MetricsDashboard() {
  const data = SimulatedMetricsDashboard;

  // Custom SVG bar graph rendering for incident count trends over time (avoiding canvas crashes)
  const renderTrendBarGraph = () => {
    const points = data.incidentTrends;
    const maxVal = Math.max(...points.map(p => p.value), 10);
    const width = 500;
    const height = 140;
    const padding = 20;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    const barWidth = (chartWidth / points.length) * 0.6;
    const spacing = (chartWidth / points.length) * 0.4;

    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 font-mono text-xs">
        <div className="mb-3 flex items-center justify-between text-xxs border-b border-slate-800 pb-2">
          <span className="font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Icons.BarChart3 className="h-4 w-4 text-indigo-400" />
            <span>Outage Count Historical Trends</span>
          </span>
          <span className="text-slate-500 font-semibold">PAST 7 DAYS</span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
          {points.map((p, i) => {
            const barHeight = (p.value / maxVal) * chartHeight;
            const x = padding + i * (barWidth + spacing) + spacing / 2;
            const y = padding + chartHeight - barHeight;
            return (
              <g key={i} className="group cursor-help">
                {/* Bar rect */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="2"
                  fill="url(#bar-gradient)"
                  className="transition-all duration-300 hover:fill-indigo-400"
                />
                {/* Value tooltip label text */}
                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  fill="#a5b4fc"
                  fontSize="7"
                  textAnchor="middle"
                  className="hidden group-hover:block font-bold"
                >
                  {p.value}
                </text>
                {/* Date labels */}
                <text
                  x={x + barWidth / 2}
                  y={height - 2}
                  fill="#64748b"
                  fontSize="7"
                  textAnchor="middle"
                >
                  {p.label}
                </text>
              </g>
            );
          })}
          <defs>
            <linearGradient id="bar-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#4f46e5" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  };

  return (
    <div className="space-y-4 font-sans text-xs">
      {/* 1. HIGH DENSITY METRIC CARDS GRID */}
      <div className="grid grid-cols-4 gap-4">
        
        {/* CARD 1: ACTIVE SLAS */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 relative overflow-hidden flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xxs font-bold text-slate-500 uppercase tracking-wider">Active Outage SLAs</div>
            <div className="text-2xl font-black text-indigo-400 font-display">{data.activeSlas}</div>
            <div className="text-[10px] text-indigo-300">Under strict telemetry alert</div>
          </div>
          <div className="rounded-lg bg-indigo-500/10 p-2.5 text-indigo-400">
            <Icons.AlertTriangle className="h-5 w-5 animate-pulse" />
          </div>
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-indigo-500" />
        </div>

        {/* CARD 2: CSAT RATING */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 relative overflow-hidden flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xxs font-bold text-slate-500 uppercase tracking-wider">Customer CSAT Benchmark</div>
            <div className="text-2xl font-black text-emerald-400 font-display">{data.csat}%</div>
            <div className="text-[10px] text-emerald-300">+2.4% above SLA requirement</div>
          </div>
          <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-400">
            <Icons.Heart className="h-5 w-5" />
          </div>
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-emerald-500" />
        </div>

        {/* CARD 3: ACTIVE SYSTEM AGENTS */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 relative overflow-hidden flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xxs font-bold text-slate-500 uppercase tracking-wider">AI Coprocessors Online</div>
            <div className="text-2xl font-black text-white font-display">{data.activeAgents} / 19</div>
            <div className="text-[10px] text-slate-400">Memory matrix synched</div>
          </div>
          <div className="rounded-lg bg-slate-500/10 p-2.5 text-slate-400">
            <Icons.Bot className="h-5 w-5" />
          </div>
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-slate-500" />
        </div>

        {/* CARD 4: PLATFORM UPTIME */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 relative overflow-hidden flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xxs font-bold text-slate-500 uppercase tracking-wider">Service Level Agreement</div>
            <div className="text-2xl font-black text-amber-400 font-display">{data.uptimePct}%</div>
            <div className="text-[10px] text-amber-300">Operational SLA: 99.95%</div>
          </div>
          <div className="rounded-lg bg-amber-500/10 p-2.5 text-amber-400">
            <Icons.Clock className="h-5 w-5" />
          </div>
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-amber-500" />
        </div>

      </div>

      {/* 2. TREND CHART & TELEMETRY LOADS GRID */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* Left Side: Historical Chart */}
        <div className="col-span-8 space-y-4">
          {renderTrendBarGraph()}

          {/* Active alerts panel */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
            <h4 className="mb-3 font-display font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-800 pb-2">
              <Icons.Activity className="h-4 w-4" />
              <span>Real-Time NOC Telemetry Streams</span>
            </h4>
            <div className="space-y-2.5 font-mono text-[10px]">
              <div className="flex items-center justify-between rounded border border-rose-500/10 bg-rose-500/5 px-3 py-2 text-rose-300">
                <div className="flex items-center space-x-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                  <span>CRITICAL ALERT: Kubernetes Billing Core pod reported OOM (Exit code 137).</span>
                </div>
                <span>22:13 UTC</span>
              </div>

              <div className="flex items-center justify-between rounded border border-amber-500/10 bg-amber-500/5 px-3 py-2 text-amber-300">
                <div className="flex items-center space-x-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span>WARNING ALERT: PostgreSQL Ledger DB Row lock contention exceeded 28 sessions.</span>
                </div>
                <span>22:18 UTC</span>
              </div>

              <div className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/30 px-3 py-2 text-slate-400">
                <div className="flex items-center space-x-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                  <span>INFO: Redis cache eviction sweep executed. Reclaimed 420MB.</span>
                </div>
                <span>21:40 UTC</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Telemetry resource meters */}
        <div className="col-span-4 rounded-xl border border-slate-800 bg-slate-900/30 p-4 space-y-4">
          <h4 className="font-display font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-800 pb-2">
            <Icons.Cpu className="h-4 w-4" />
            <span>Coprocessor Resources</span>
          </h4>

          {/* Meter 1: System Memory */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xxs font-mono text-slate-400">
              <span>Docker Node Allocations</span>
              <span className="text-white font-bold">{data.systemMemoryPercent}%</span>
            </div>
            <div className="h-2 w-full rounded bg-slate-950 overflow-hidden">
              <div className="h-full bg-indigo-500 rounded" style={{ width: `${data.systemMemoryPercent}%` }} />
            </div>
          </div>

          {/* Meter 2: CPU Utilization */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xxs font-mono text-slate-400">
              <span>Processor Cluster load</span>
              <span className="text-white font-bold">{data.cpuUtilization}%</span>
            </div>
            <div className="h-2 w-full rounded bg-slate-950 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded" style={{ width: `${data.cpuUtilization}%` }} />
            </div>
          </div>

          {/* Meter 3: Remediation SLA uptake */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xxs font-mono text-slate-400">
              <span>Remediation Auto-Approve</span>
              <span className="text-white font-bold">{data.remediationUptake}%</span>
            </div>
            <div className="h-2 w-full rounded bg-slate-950 overflow-hidden">
              <div className="h-full bg-indigo-400 rounded" style={{ width: `${data.remediationUptake}%` }} />
            </div>
          </div>

          {/* Additional details */}
          <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3 font-mono text-[9px] text-slate-400 leading-relaxed space-y-1">
            <div className="font-bold text-slate-300 mb-1">CLUSTER OVERVIEW:</div>
            <div>• Database Nodes: <span className="text-emerald-400 font-semibold">Postgres Primary (Active), Replica (Active)</span></div>
            <div>• RabbitMQ Brokers: <span className="text-emerald-400 font-semibold">Rabbit-1 (Syncing), Rabbit-2 (Syncing)</span></div>
            <div>• OpenSearch Vector Shards: <span className="text-indigo-400">12 / 12 InSync</span></div>
          </div>
        </div>

      </div>
    </div>
  );
}

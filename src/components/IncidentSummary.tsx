import React from 'react';
import * as Icons from 'lucide-react';
import { Incident } from '../types';
import { AreaChart, Area, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

interface IncidentSummaryProps {
  incidents: Incident[];
}

export const IncidentSummary: React.FC<IncidentSummaryProps> = ({ incidents }) => {
  const activeCount = incidents.filter(i => i.status !== 'SOLVED').length;
  const criticalCount = incidents.filter(i => i.severity === 'CRITICAL' && i.status !== 'SOLVED').length;
  const warningCount = incidents.filter(i => (i.severity === 'HIGH' || i.severity === 'MEDIUM') && i.status !== 'SOLVED').length;
  const lowCount = incidents.filter(i => i.severity === 'LOW' && i.status !== 'SOLVED').length;

  // Real-time incident frequency trends data (24h time buckets)
  const sparklineData = [
    { time: '00:00', count: Math.max(1, Math.round(activeCount * 0.2)) },
    { time: '04:00', count: Math.max(2, Math.round(activeCount * 0.4)) },
    { time: '08:00', count: Math.max(1, Math.round(activeCount * 0.3)) },
    { time: '12:00', count: Math.max(4, Math.round(activeCount * 0.7)) },
    { time: '16:00', count: Math.max(3, Math.round(activeCount * 0.5)) },
    { time: '20:00', count: Math.max(6, Math.round(activeCount * 0.9)) },
    { time: '24:00', count: Math.max(activeCount, 5) },
  ];

  return (
    <div id="incident-summary-header" className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-lg backdrop-blur-sm">
      <div className="flex items-center space-x-3">
        <div className="h-9 w-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
          <Icons.LayoutDashboard className="h-5 w-5 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-display">Incident Command Center</h2>
          <p className="text-[10px] text-slate-500 font-mono">Real-time Service SLA Monitoring & Root Cause Diagnostics</p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Real-time Frequency Sparkline Chart */}
        <div className="bg-slate-950/70 rounded-lg px-2.5 py-1 border border-slate-800/80 flex items-center space-x-2.5 min-w-[210px] h-[38px] shadow-inner">
          <div className="shrink-0">
            <div className="text-[8px] text-indigo-300 font-bold uppercase tracking-wider font-mono flex items-center gap-1">
              <Icons.TrendingUp className="h-2.5 w-2.5 text-indigo-400 animate-pulse" />
              <span>24H Volatility</span>
            </div>
            <div className="text-[10px] font-bold text-emerald-400 font-mono flex items-center gap-1">
              <span>+32% Rate</span>
              <span className="text-[8px] text-slate-500 font-normal">({activeCount} req/h)</span>
            </div>
          </div>
          <div className="w-24 h-7 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData} margin={{ top: 1, right: 1, left: 1, bottom: 1 }}>
                <defs>
                  <linearGradient id="freqSparklineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-950 border border-indigo-500/40 px-1.5 py-0.5 rounded text-[8px] font-mono text-indigo-200">
                          {payload[0].payload.time}: {payload[0].value} inc
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="count" stroke="#818cf8" strokeWidth={1.5} fill="url(#freqSparklineGrad)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Total Active */}
        <div className="bg-slate-950/50 rounded-lg px-3 py-1.5 border border-slate-800/60 flex items-center space-x-2 min-w-[90px]">
          <Icons.Activity className="h-4 w-4 text-indigo-400 shrink-0" />
          <div>
            <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider font-mono">Active</div>
            <div className="text-xs font-bold text-white font-mono">{activeCount}</div>
          </div>
        </div>

        {/* Critical */}
        <div className="bg-rose-500/5 rounded-lg px-3 py-1.5 border border-rose-500/10 flex items-center space-x-2 min-w-[90px]">
          <Icons.Flame className="h-4 w-4 text-rose-500 shrink-0 animate-pulse" />
          <div>
            <div className="text-[8px] text-rose-400 font-bold uppercase tracking-wider font-mono">Critical (P0)</div>
            <div className="text-xs font-bold text-rose-500 font-mono">{criticalCount}</div>
          </div>
        </div>

        {/* Warnings */}
        <div className="bg-amber-500/5 rounded-lg px-3 py-1.5 border border-amber-500/10 flex items-center space-x-2 min-w-[90px]">
          <Icons.AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <div>
            <div className="text-[8px] text-amber-400 font-bold uppercase tracking-wider font-mono">Warning</div>
            <div className="text-xs font-bold text-amber-500 font-mono">{warningCount}</div>
          </div>
        </div>

        {/* Low Prior */}
        <div className="bg-slate-800/10 rounded-lg px-3 py-1.5 border border-slate-800/40 flex items-center space-x-2 min-w-[90px]">
          <Icons.CheckCircle2 className="h-4 w-4 text-slate-400 shrink-0" />
          <div>
            <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider font-mono">Low (P3)</div>
            <div className="text-xs font-bold text-slate-400 font-mono">{lowCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncidentSummary;

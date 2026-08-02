import React, { useState } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import * as Icons from 'lucide-react';
import { InitialIncidents } from '../data/simulation';

interface SlaTrendPoint {
  time: string;
  sla: number;
}

export default function SlaHealthHeaderWidget() {
  const [showTooltip, setShowTooltip] = useState(false);

  // Calculate SLA percentage from active dataset
  const isIncInSla = (inc: any) => inc.slaRemainingSecs > 0 || inc.status === 'SOLVED';
  const totalIncidents = InitialIncidents.length;
  const inSlaCount = InitialIncidents.filter(isIncInSla).length;
  const currentSlaPercentage = Math.round((inSlaCount / (totalIncidents || 1)) * 100);

  // Severity-based breakdown
  const sev1Count = InitialIncidents.filter(i => i.severity === 'CRITICAL').length;
  const sev1InSla = InitialIncidents.filter(i => i.severity === 'CRITICAL' && isIncInSla(i)).length;
  const sev1Pct = Math.round((sev1InSla / (sev1Count || 1)) * 100);

  const sev2Count = InitialIncidents.filter(i => i.severity === 'HIGH').length;
  const sev2InSla = InitialIncidents.filter(i => i.severity === 'HIGH' && isIncInSla(i)).length;
  const sev2Pct = Math.round((sev2InSla / (sev2Count || 1)) * 100);

  // Sparkline historical trend points over 6 periods
  const trendData: SlaTrendPoint[] = [
    { time: 'T-5h', sla: 88 },
    { time: 'T-4h', sla: 91 },
    { time: 'T-3h', sla: 89 },
    { time: 'T-2h', sla: 95 },
    { time: 'T-1h', sla: 92 },
    { time: 'Now', sla: currentSlaPercentage },
  ];

  const getStatusColor = (pct: number) => {
    if (pct >= 90) return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', stroke: '#10b981' };
    if (pct >= 75) return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', stroke: '#f59e0b' };
    return { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30', stroke: '#f43f5e' };
  };

  const colors = getStatusColor(currentSlaPercentage);

  return (
    <div className="relative group">
      <div 
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`hidden xl:flex items-center space-x-2.5 rounded-lg border ${colors.border} bg-slate-900/40 px-2.5 py-1 font-mono text-[10px] select-none cursor-pointer transition-all hover:bg-slate-900/80`}
      >
        <Icons.ShieldCheck className={`h-3.5 w-3.5 ${colors.text}`} />
        
        <div className="flex flex-col">
          <div className="text-[7.5px] font-bold text-slate-500 uppercase leading-none mb-0.5">SLA Health</div>
          <div className="flex items-center space-x-1 leading-none">
            <span className={`font-bold font-display text-[10.5px] ${colors.text}`}>{currentSlaPercentage}%</span>
            <span className="text-[7.5px] text-slate-400 font-semibold uppercase">met</span>
          </div>
        </div>

        {/* Recharts Sparkline Trend */}
        <div className="w-14 h-4 relative">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <Line 
                type="monotone" 
                dataKey="sla" 
                stroke={colors.stroke} 
                strokeWidth={1.8} 
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Popover Breakdown Tooltip */}
      {showTooltip && (
        <div className="absolute top-full left-0 mt-1.5 w-56 rounded-xl border border-slate-800 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl z-50 text-xxs font-mono space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="font-bold text-white flex items-center space-x-1">
              <Icons.Activity className="h-3 w-3 text-indigo-400" />
              <span>SLA Health Metrics</span>
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${colors.bg} ${colors.text} ${colors.border}`}>
              {currentSlaPercentage}% Compliant
            </span>
          </div>

          <div className="space-y-1.5 text-slate-300">
            <div className="flex justify-between items-center text-[9px]">
              <span className="text-slate-400">Total Active Tickets:</span>
              <span className="font-bold text-white">{totalIncidents}</span>
            </div>
            <div className="flex justify-between items-center text-[9px]">
              <span className="text-slate-400">In SLA Compliance:</span>
              <span className="font-bold text-emerald-400">{inSlaCount} / {totalIncidents}</span>
            </div>

            <div className="border-t border-slate-900 pt-1.5 space-y-1">
              <div className="flex justify-between text-[8px]">
                <span className="text-rose-400 font-bold">SEV-1 Target (30m):</span>
                <span className="text-slate-200">{sev1InSla}/{sev1Count} ({sev1Pct}%)</span>
              </div>
              <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full" style={{ width: `${sev1Pct}%` }} />
              </div>

              <div className="flex justify-between text-[8px] pt-1">
                <span className="text-amber-400 font-bold">SEV-2 Target (60m):</span>
                <span className="text-slate-200">{sev2InSla}/{sev2Count} ({sev2Pct}%)</span>
              </div>
              <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${sev2Pct}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

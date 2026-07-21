import React from 'react';
import * as Icons from 'lucide-react';
import { Incident } from '../types';

interface IncidentSummaryProps {
  incidents: Incident[];
}

export const IncidentSummary: React.FC<IncidentSummaryProps> = ({ incidents }) => {
  const activeCount = incidents.filter(i => i.status !== 'SOLVED').length;
  const criticalCount = incidents.filter(i => i.severity === 'CRITICAL' && i.status !== 'SOLVED').length;
  const warningCount = incidents.filter(i => (i.severity === 'HIGH' || i.severity === 'MEDIUM') && i.status !== 'SOLVED').length;
  const lowCount = incidents.filter(i => i.severity === 'LOW' && i.status !== 'SOLVED').length;

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

      <div className="flex items-center gap-2">
        {/* Total Active */}
        <div className="bg-slate-950/50 rounded-lg px-3 py-1.5 border border-slate-800/60 flex items-center space-x-2 min-w-[100px]">
          <Icons.Activity className="h-4 w-4 text-indigo-400 shrink-0" />
          <div>
            <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider font-mono">Active</div>
            <div className="text-xs font-bold text-white font-mono">{activeCount}</div>
          </div>
        </div>

        {/* Critical */}
        <div className="bg-rose-500/5 rounded-lg px-3 py-1.5 border border-rose-500/10 flex items-center space-x-2 min-w-[100px]">
          <Icons.Flame className="h-4 w-4 text-rose-500 shrink-0 animate-pulse" />
          <div>
            <div className="text-[8px] text-rose-400 font-bold uppercase tracking-wider font-mono">Critical (P0)</div>
            <div className="text-xs font-bold text-rose-500 font-mono">{criticalCount}</div>
          </div>
        </div>

        {/* Warnings */}
        <div className="bg-amber-500/5 rounded-lg px-3 py-1.5 border border-amber-500/10 flex items-center space-x-2 min-w-[100px]">
          <Icons.AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <div>
            <div className="text-[8px] text-amber-400 font-bold uppercase tracking-wider font-mono">Warning (P1/P2)</div>
            <div className="text-xs font-bold text-amber-500 font-mono">{warningCount}</div>
          </div>
        </div>

        {/* Low Prior */}
        <div className="bg-slate-800/10 rounded-lg px-3 py-1.5 border border-slate-800/40 flex items-center space-x-2 min-w-[100px]">
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

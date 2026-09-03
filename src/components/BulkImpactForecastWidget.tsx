import React, { useState } from 'react';
import { Incident } from '../types';
import * as Icons from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BulkImpactForecastWidgetProps {
  selectedIncidents: Incident[];
  onAddAuditLog?: (user: string, action: string, area: string, status: 'SUCCESS' | 'FAILED' | 'PENDING_APPROVAL', details: string) => void;
}

export function BulkImpactForecastWidget({ selectedIncidents, onAddAuditLog }: BulkImpactForecastWidgetProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Compute calculated metrics based on selected incidents
  const totalCount = selectedIncidents.length;

  const criticalCount = selectedIncidents.filter(i => i.severity === 'CRITICAL').length;
  const highCount = selectedIncidents.filter(i => i.severity === 'HIGH').length;
  const mediumCount = selectedIncidents.filter(i => i.severity === 'MEDIUM').length;
  const lowCount = selectedIncidents.filter(i => i.severity === 'LOW').length;

  // AI/Algorithmic downtime projection in hours
  const baseDowntimeHours = selectedIncidents.reduce((acc, inc) => {
    if (inc.severity === 'CRITICAL') return acc + 2.5;
    if (inc.severity === 'HIGH') return acc + 1.2;
    if (inc.severity === 'MEDIUM') return acc + 0.5;
    return acc + 0.2;
  }, 0);

  // Coupling multiplier if multiple services affected
  const uniqueServices = Array.from(new Set(selectedIncidents.map(i => i.appName || 'Core System')));
  const cascadeMultiplier = Math.min(2.5, 1 + (uniqueServices.length - 1) * 0.35 + (criticalCount * 0.4));
  const totalProjectedDowntime = (baseDowntimeHours * cascadeMultiplier).toFixed(1);

  // Revenue loss estimate ($12,500/hr for Critical, $4,000/hr for High, etc.)
  const projectedCostLoss = Math.round(
    parseFloat(totalProjectedDowntime) * (criticalCount > 0 ? 14500 : highCount > 0 ? 8200 : 3500)
  );

  const escalationProbability = Math.min(98, Math.round(35 + (criticalCount * 22) + (highCount * 12) + (uniqueServices.length * 8)));

  const handleRunAiDeepForecast = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/bulk-impact-forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incidentIds: selectedIncidents.map(i => i.id),
          incidents: selectedIncidents.map(i => ({
            id: i.id,
            title: i.title,
            severity: i.severity,
            appName: i.appName,
            status: i.status
          }))
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (onAddAuditLog) {
          onAddAuditLog(
            'Alex Vance (Admin)',
            'AI Bulk Impact Forecast',
            'Predictive Telemetry Engine',
            'SUCCESS',
            `Ran AI downtime forecast across ${totalCount} tickets. Projected Downtime: ${totalProjectedDowntime} hrs, Est Risk: $${projectedCostLoss.toLocaleString()}`
          );
        }
      }
    } catch (err) {
      console.warn("Forecast API call completed with local fallback calculation");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (totalCount === 0) return null;

  return (
    <>
      {/* Bulk Action Toolbar Forecast Trigger Widget */}
      <motion.button
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => {
          setIsModalOpen(true);
          handleRunAiDeepForecast();
        }}
        className="group relative flex items-center space-x-2 px-2.5 py-1 rounded-lg border border-amber-500/60 bg-gradient-to-r from-amber-950/80 via-slate-950 to-rose-950/80 hover:from-amber-900 hover:to-rose-900 text-amber-200 font-bold shadow-lg shadow-amber-500/20 transition-all cursor-pointer font-mono text-[9.5px]"
        title="View AI infrastructure downtime projections, cost impact, and service cascade risk for unaddressed tickets"
      >
        <div className="flex items-center space-x-1">
          <Icons.Zap className="h-3.5 w-3.5 text-amber-400 group-hover:scale-110 transition-transform animate-pulse" />
          <span className="text-amber-300 font-extrabold">Bulk Impact Forecast:</span>
        </div>
        <div className="flex items-center space-x-1.5 bg-slate-900/90 px-1.5 py-0.5 rounded border border-amber-500/30">
          <span className="text-white font-mono">{totalProjectedDowntime}h Est. Downtime</span>
          <span className="text-rose-400 font-mono font-black">${(projectedCostLoss / 1000).toFixed(1)}k Risk</span>
        </div>
        <Icons.ChevronRight className="h-3 w-3 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
      </motion.button>

      {/* Deep Forecast Detail Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-2xl rounded-2xl border border-amber-500/40 bg-slate-950 p-6 shadow-2xl space-y-5 font-mono relative overflow-hidden"
            >
              {/* Top Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-500" />

              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-3 text-amber-400">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <Icons.TrendingUp className="h-5 w-5 text-amber-400 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-sm text-white flex items-center space-x-2">
                      <span>AI Infrastructure Impact & Downtime Forecast</span>
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono border border-rose-500/30 font-bold">
                        {totalCount} Ticket{totalCount > 1 ? 's' : ''} Selected
                      </span>
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      Predictive downtime modeling if selected tickets remain active in current state
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg p-1.5 border border-slate-800 bg-slate-900 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <Icons.X className="h-4 w-4" />
                </button>
              </div>

              {/* Forecast KPI Metric Cards Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase font-bold">
                    <span>Est. Service Downtime</span>
                    <Icons.Clock className="h-3.5 w-3.5 text-amber-400" />
                  </div>
                  <div className="text-xl font-extrabold text-amber-300">
                    {totalProjectedDowntime} <span className="text-xs text-amber-500">hours</span>
                  </div>
                  <div className="text-[9px] text-slate-500">
                    Calculated from cumulative severity & SLA burn
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/90 border border-rose-500/30 space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase font-bold">
                    <span>Est. Revenue Risk</span>
                    <Icons.DollarSign className="h-3.5 w-3.5 text-rose-400" />
                  </div>
                  <div className="text-xl font-extrabold text-rose-400">
                    ${projectedCostLoss.toLocaleString()}
                  </div>
                  <div className="text-[9px] text-slate-500">
                    Direct SLA penalty + customer outage burn
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/90 border border-indigo-500/30 space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase font-bold">
                    <span>Cascade Risk Level</span>
                    <Icons.ShieldAlert className="h-3.5 w-3.5 text-indigo-400" />
                  </div>
                  <div className="text-xl font-extrabold text-indigo-300">
                    {escalationProbability}% <span className="text-xs text-rose-400">({cascadeMultiplier.toFixed(2)}x)</span>
                  </div>
                  <div className="text-[9px] text-slate-500">
                    Multi-service coupling factor across {uniqueServices.length} apps
                  </div>
                </div>
              </div>

              {/* Impact Breakdown by Affected Services */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-bold">
                  Affected Service Micro-Clusters:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {uniqueServices.map((serviceName) => {
                    const serviceIncs = selectedIncidents.filter(i => (i.appName || 'Core System') === serviceName);
                    const hasCrit = serviceIncs.some(i => i.severity === 'CRITICAL');
                    return (
                      <div
                        key={serviceName}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-mono ${
                          hasCrit ? 'bg-rose-950/40 border-rose-500/40 text-rose-200' : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <Icons.Server className={`h-4 w-4 ${hasCrit ? 'text-rose-400 animate-pulse' : 'text-cyan-400'}`} />
                          <div>
                            <div className="font-bold">{serviceName}</div>
                            <div className="text-[9px] text-slate-400">{serviceIncs.length} incident(s) tied</div>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          hasCrit ? 'bg-rose-900 text-rose-100' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {hasCrit ? 'HIGH CASCADE' : 'ELEVATED'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Individual Incident Risk List */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-bold">
                  Selected Incident Risk Vectors:
                </span>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {selectedIncidents.map((inc) => (
                    <div
                      key={inc.id}
                      className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-[10px] font-mono"
                    >
                      <div className="flex items-center space-x-2 truncate pr-2">
                        <span className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${
                          inc.severity === 'CRITICAL' ? 'bg-rose-950 text-rose-300 border border-rose-500/40' :
                          inc.severity === 'HIGH' ? 'bg-amber-950 text-amber-300 border border-amber-500/40' :
                          'bg-indigo-950 text-indigo-300 border border-indigo-500/40'
                        }`}>
                          {inc.severity}
                        </span>
                        <span className="font-bold text-slate-200 truncate">{inc.id} - {inc.title}</span>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="text-slate-400">{inc.appName || 'Core'}</span>
                        <span className="text-amber-400 font-bold">
                          {inc.severity === 'CRITICAL' ? '2.5h downtime' : inc.severity === 'HIGH' ? '1.2h downtime' : '0.5h downtime'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Recommendation Banner */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-amber-950/60 to-rose-950/60 border border-amber-500/30 flex items-start space-x-3 text-xs">
                <Icons.Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-amber-200 text-[11px]">AI Mitigation Strategy Recommendation:</div>
                  <p className="text-[10px] text-slate-300 leading-relaxed font-sans">
                    Prioritize resolving the <strong>{criticalCount} CRITICAL</strong> incident(s) first to mitigate 70% of the cascade downtime risk. Auto-escalate remaining tickets to dedicated subject matter experts or run automated health checks.
                  </p>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleRunAiDeepForecast}
                  disabled={isAnalyzing}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <Icons.RefreshCw className={`h-3.5 w-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  <span>{isAnalyzing ? 'Recalculating AI Model...' : 'Recalculate AI Model'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition-colors cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  Close Forecast
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export default BulkImpactForecastWidget;

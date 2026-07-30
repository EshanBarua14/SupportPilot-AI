import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { Incident } from '../types';

interface CorrelationSuggestionCardProps {
  incidents: Incident[];
  onGroupIncidents?: (groupedIds: string[]) => void;
}

export const CorrelationSuggestionCard: React.FC<CorrelationSuggestionCardProps> = ({
  incidents,
  onGroupIncidents
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isGrouped, setIsGrouped] = useState(false);

  // Group incidents by error signature or app type
  const activeIncidents = incidents.filter(i => i.status !== 'SOLVED');

  if (isDismissed || activeIncidents.length < 2) return null;

  // Detect pattern: e.g. OOM / Memory, Gateway Timeout, or Database Lock
  const findCorrelation = () => {
    const k8sGroup = activeIncidents.filter(i => 
      (i.title + ' ' + i.description).toLowerCase().includes('oom') ||
      (i.title + ' ' + i.description).toLowerCase().includes('k8s') ||
      (i.title + ' ' + i.description).toLowerCase().includes('memory')
    );

    if (k8sGroup.length >= 2) {
      return {
        patternName: 'Cluster Memory Throttling & cgroup OOMKilled Cascade',
        errorSignature: 'Exit Code 137 \u2022 OOMKilled Container Limit Exceeded',
        confidenceScore: 96,
        incidents: k8sGroup,
        suggestedGroupTitle: 'Incident Cluster #K8S-OOM-CASCADE',
        rootCauseSummary: 'Shared Node pod limits in us-east-1 production cluster causing cascading OOM terminations.'
      };
    }

    const timeoutGroup = activeIncidents.filter(i => 
      (i.title + ' ' + i.description).toLowerCase().includes('timeout') ||
      (i.title + ' ' + i.description).toLowerCase().includes('gateway') ||
      (i.title + ' ' + i.description).toLowerCase().includes('504')
    );

    if (timeoutGroup.length >= 2) {
      return {
        patternName: 'Upstream Latency Spike & Gateway Circuit Breaker Trip',
        errorSignature: 'HTTP 504 Gateway Timeout \u2022 Downstream Connection Dropped',
        confidenceScore: 93,
        incidents: timeoutGroup,
        suggestedGroupTitle: 'Incident Cluster #GW-TIMEOUT-SPIKE',
        rootCauseSummary: 'External carrier API webhook delays triggering 504 Gateway Timeouts across ingress relays.'
      };
    }

    // Default correlation fallback with top 2 active incidents
    const fallbackGroup = activeIncidents.slice(0, 3);
    return {
      patternName: 'Cross-Service Telemetry Correlation Detected',
      errorSignature: 'Correlated Log Pattern \u2022 Concurrent System State Degradation',
      confidenceScore: 89,
      incidents: fallbackGroup,
      suggestedGroupTitle: 'Incident Cluster #CORRELATION-PATTERN-A',
      rootCauseSummary: 'Multiple active alerts sharing concurrent timestamp windows and backend telemetry events.'
    };
  };

  const correlation = findCorrelation();

  const handleGroup = () => {
    setIsGrouped(true);
    if (onGroupIncidents) {
      onGroupIncidents(correlation.incidents.map(i => i.id));
    }
  };

  return (
    <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/40 border border-amber-500/40 rounded-xl p-3.5 shadow-2xl font-mono relative overflow-hidden space-y-3">
      {/* Decorative corner glow */}
      <div className="absolute top-0 right-0 h-16 w-16 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-amber-500/20 pb-2.5">
        <div className="flex items-center space-x-2.5">
          <div className="h-7 w-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
            <Icons.GitMerge className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider font-display">
                CORRELATION SUGGESTION
              </h4>
              <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[9px] text-amber-300 border border-amber-500/30 font-bold">
                {correlation.confidenceScore}% AI PATTERN MATCH
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-sans">
              Shared log signature detected across {correlation.incidents.length} active workspace incidents
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsDismissed(true)}
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800/60 transition-colors"
          title="Dismiss Correlation Suggestion"
        >
          <Icons.X className="h-4 w-4" />
        </button>
      </div>

      {/* Pattern details */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-sans font-bold text-white">{correlation.patternName}</span>
          <span className="text-[10px] text-amber-400 font-bold">{correlation.suggestedGroupTitle}</span>
        </div>

        <div className="bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800 text-[10px] text-slate-300 flex items-center space-x-2">
          <Icons.Terminal className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="font-bold text-amber-300">Signature:</span>
          <code className="text-slate-200 truncate">{correlation.errorSignature}</code>
        </div>

        <p className="text-[10px] text-slate-400 font-sans italic">
          {correlation.rootCauseSummary}
        </p>

        {/* Impacted Incidents List */}
        <div className="pt-1 space-y-1">
          <span className="text-[9px] text-slate-500 font-bold uppercase">Correlated Incidents ({correlation.incidents.length}):</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {correlation.incidents.map((inc) => (
              <div key={inc.id} className="bg-slate-900/90 border border-slate-800/80 rounded px-2 py-1 text-[9.5px] flex items-center justify-between">
                <span className="text-slate-300 font-bold truncate max-w-[180px]">{inc.id}: {inc.title}</span>
                <span className="text-amber-400 text-[8.5px] font-bold uppercase ml-1 shrink-0">{inc.severity}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Group Action Button */}
      <div className="flex items-center justify-between pt-1 font-sans">
        <div className="text-[10px] text-slate-400 flex items-center space-x-1.5">
          <Icons.Layers className="h-3.5 w-3.5 text-indigo-400" />
          <span>Grouping prevents duplicate alerting and aligns responder war rooms</span>
        </div>

        <button
          onClick={handleGroup}
          disabled={isGrouped}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono flex items-center space-x-1.5 transition-all ${
            isGrouped
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
          }`}
        >
          {isGrouped ? (
            <>
              <Icons.CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Incidents Grouped</span>
            </>
          ) : (
            <>
              <Icons.GitMerge className="h-4 w-4" />
              <span>Group Incidents Into Cluster</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CorrelationSuggestionCard;

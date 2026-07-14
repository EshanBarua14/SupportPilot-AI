import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as Icons from 'lucide-react';
import { Incident } from '../types';

interface IncidentDetailsDrawerProps {
  incidentId: string | null;
  incident?: Incident;
  onClose: () => void;
  onAddAuditLog: (operator: string, action: string, module: string, status: 'SUCCESS' | 'FAILED' | 'PENDING_APPROVAL', payload: string) => void;
}

interface CorrelatedLog {
  timestamp: string;
  level: string;
  source: string;
  message: string;
}

interface CorrelationData {
  incidentId: string;
  anomaliesFound: number;
  clusterName: string;
  namespace: string;
  impactedServices: string[];
  correlatedLogs: CorrelatedLog[];
  dbTransactions: {
    status: string;
    uncommittedCount: number;
    activeLocks: Array<{ blocked_pid: number; blocking_pid: number; statement: string }>;
  };
  aiCorrelationSummary: string;
}

export default function IncidentDetailsDrawer({ incidentId, incident, onClose, onAddAuditLog }: IncidentDetailsDrawerProps) {
  const [data, setData] = useState<CorrelationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getStageStates = (status?: string): Record<string, 'completed' | 'active' | 'pending'> => {
    const states: Record<string, 'completed' | 'active' | 'pending'> = {
      identification: 'completed',
      triage: 'pending',
      remediation: 'pending',
      resolution: 'pending',
    };

    if (!status) return states;

    if (status === 'OPEN') {
      states.triage = 'active';
    } else if (status === 'INVESTIGATING' || status === 'ESCALATED') {
      states.triage = 'completed';
      states.remediation = 'active';
    } else if (status === 'SOLVED') {
      states.triage = 'completed';
      states.remediation = 'completed';
      states.resolution = 'completed';
    }

    return states;
  };

  const stageStates = getStageStates(incident?.status);

  const stages = [
    { id: 'identification', label: 'Identification', icon: Icons.AlertCircle, sub: 'Logged' },
    { id: 'triage', label: 'Triage', icon: Icons.Search, sub: 'Assigned' },
    { id: 'remediation', label: 'Remediation', icon: Icons.Activity, sub: 'Mitigating' },
    { id: 'resolution', label: 'Resolution', icon: Icons.CheckCircle2, sub: 'Resolved' },
  ];

  useEffect(() => {
    if (!incidentId) return;

    const fetchCorrelation = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/incidents/${incidentId}/correlation`);
        if (!response.ok) {
          throw new Error("Failed to fetch backend correlation stream.");
        }
        const json = await response.json();
        setData(json);
        onAddAuditLog(
          "Telemetry Engine", 
          "Fetch Correlation Data", 
          "Incident Analysis", 
          "SUCCESS", 
          `Fetched correlated server metrics and ${json.correlatedLogs.length} related telemetry logs for ${incidentId}.`
        );
      } catch (err: any) {
        setError(err.message || "Unknown retrieval exception.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCorrelation();
  }, [incidentId]);

  return (
    <AnimatePresence>
      {incidentId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs">
          {/* Overlay mask */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-transparent"
          />

          {/* Drawer container */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="relative flex h-full w-full max-w-lg flex-col border-l border-slate-900 bg-slate-950 p-6 shadow-2xl overflow-y-auto select-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-900 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-400">
                  <Icons.GitMerge className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm text-white">Log Correlation Stream</h3>
                  <p className="font-mono text-xxs text-slate-500">ID: {incidentId}</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-white transition-colors"
              >
                <Icons.X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Content area */}
            <div className="flex-1 space-y-5 pt-5 text-xs text-slate-300">
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                  <Icons.Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
                  <p className="font-mono text-xxs text-slate-500">Querying distributed tracing pipeline...</p>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4 text-rose-400">
                  <div className="flex items-center space-x-2 font-bold mb-1">
                    <Icons.AlertTriangle className="h-4 w-4" />
                    <span>Telemetry Handshake Error</span>
                  </div>
                  <p className="font-mono text-xxs">{error}</p>
                </div>
              )}

              {!isLoading && !error && data && (
                <div className="space-y-5 select-text">
                  
                  {/* Visual Step-by-Step Incident Progress Tracker */}
                  <div className="rounded-xl border border-slate-900 bg-slate-900/25 p-4.5 space-y-3.5 select-none">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-display font-medium uppercase tracking-wider text-xxs">Incident Lifecycle Stage</span>
                      <span className="font-mono text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full font-bold">
                        {incident?.status || 'UNKNOWN'}
                      </span>
                    </div>

                    <div className="relative flex items-center justify-between pt-2">
                      {/* Connector Line Background */}
                      <div className="absolute left-4 right-4 top-[21px] h-[2px] bg-slate-800" />
                      {/* Active Connector Fill */}
                      <div 
                        className="absolute left-4 top-[21px] h-[2px] bg-gradient-to-r from-emerald-500 via-indigo-500 to-indigo-600 transition-all duration-500" 
                        style={{ 
                          width: incident?.status === 'SOLVED' 
                            ? 'calc(100% - 32px)' 
                            : incident?.status === 'INVESTIGATING' || incident?.status === 'ESCALATED'
                              ? '50%'
                              : '16.66%'
                        }}
                      />

                      {stages.map((stg) => {
                        const state = stageStates[stg.id];
                        const IconComponent = stg.icon;
                        
                        return (
                          <div key={stg.id} className="flex flex-col items-center space-y-1.5 relative z-10 flex-1">
                            {/* Circle Indicator */}
                            <div className={`h-[28px] w-[28px] rounded-full border flex items-center justify-center transition-all duration-300 ${
                              state === 'completed'
                                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-500/10'
                                : state === 'active'
                                  ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400 animate-pulse shadow-md shadow-indigo-500/25 scale-[1.05]'
                                  : 'bg-slate-950 border-slate-800 text-slate-500'
                            }`}>
                              {state === 'completed' ? (
                                <Icons.Check className="h-4 w-4 stroke-[2.5]" />
                              ) : (
                                <IconComponent className="h-3.5 w-3.5" />
                              )}
                            </div>

                            {/* Text labels */}
                            <div className="text-center">
                              <p className={`font-display text-[10px] font-bold ${
                                state === 'completed'
                                  ? 'text-slate-200'
                                  : state === 'active'
                                    ? 'text-indigo-400 font-extrabold'
                                    : 'text-slate-500'
                              }`}>
                                {stg.label}
                              </p>
                              <p className="text-[8px] text-slate-500 font-mono leading-none mt-0.5">
                                {stg.sub}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* System Metadata bento boxes */}
                  <div className="grid grid-cols-2 gap-3 font-mono text-[10px]">
                    <div className="rounded-lg border border-slate-900 bg-slate-900/30 p-2.5">
                      <span className="text-slate-500">K8S CLUSTER</span>
                      <span className="block font-bold text-white mt-1">{data.clusterName}</span>
                    </div>
                    <div className="rounded-lg border border-slate-900 bg-slate-900/30 p-2.5">
                      <span className="text-slate-500">NAMESPACE</span>
                      <span className="block font-bold text-indigo-400 mt-1">{data.namespace}</span>
                    </div>
                  </div>

                  {/* AI Summary Banner */}
                  <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-1.5">
                    <div className="flex items-center space-x-1.5 font-display font-semibold text-xs text-indigo-400">
                      <Icons.Cpu className="h-4 w-4 text-indigo-400" />
                      <span>Neural Diagnostic Correlator</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed text-xxs font-sans">{data.aiCorrelationSummary}</p>
                  </div>

                  {/* Impacted Services */}
                  <div className="space-y-1.5">
                    <span className="text-slate-400 font-display font-medium uppercase tracking-wider text-xxs">Downstream Impact Analysis</span>
                    <div className="flex flex-wrap gap-1.5">
                      {data.impactedServices.map((srv, idx) => (
                        <span key={idx} className="rounded border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 font-mono text-xxs text-indigo-300">
                          {srv}
                        </span>
                      ))}
                      <span className="rounded border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 font-mono text-xxs text-rose-300 animate-pulse flex items-center space-x-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        <span>{data.anomaliesFound} anomalies detected</span>
                      </span>
                    </div>
                  </div>

                  {/* Database Locking details */}
                  <div className="rounded-lg border border-slate-900 bg-slate-900/10 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xxs text-slate-400">PostgreSQL Locks</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-mono font-bold ${
                        data.dbTransactions.status === 'HEALTHY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {data.dbTransactions.status}
                      </span>
                    </div>
                    {data.dbTransactions.activeLocks.length > 0 ? (
                      <div className="font-mono text-[9px] bg-slate-950 p-2 rounded text-amber-300 border border-amber-500/10 space-y-1">
                        <span className="text-slate-500 font-bold block">BLOCKED TRANSACTION DETAILS:</span>
                        {data.dbTransactions.activeLocks.map((lock, i) => (
                          <div key={i} className="leading-normal">
                            PID {lock.blocked_pid} is blocked by PID {lock.blocking_pid} executing query:
                            <code className="block text-slate-300 mt-1 pl-1 border-l border-slate-800 break-words">{lock.statement}</code>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xxs text-slate-500">No lock contention or waiting threads in relational pool.</p>
                    )}
                  </div>

                  {/* Correlated Logs Timeline */}
                  <div className="space-y-2">
                    <span className="text-slate-400 font-display font-medium uppercase tracking-wider text-xxs block">Correlated Microservice Logs</span>
                    <div className="rounded-lg border border-slate-900 bg-slate-950 p-3 font-mono text-[10px] space-y-2.5 max-h-56 overflow-y-auto">
                      {data.correlatedLogs.map((log, i) => {
                        const isErr = log.level === 'ERROR' || log.level === 'FATAL';
                        return (
                          <div key={i} className="space-y-0.5 border-b border-slate-900/60 pb-2 last:border-0 last:pb-0">
                            <div className="flex items-center justify-between text-[9px] text-slate-500">
                              <span>{log.timestamp.slice(11, 19)}</span>
                              <span className={isErr ? 'text-rose-400 font-bold' : 'text-amber-400 font-bold'}>
                                {log.level}
                              </span>
                            </div>
                            <div className="text-[10px]">
                              <span className="text-indigo-400 font-bold mr-1.5">[{log.source}]</span>
                              <span className={isErr ? 'text-rose-300' : 'text-slate-300'}>{log.message}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Footer action button */}
            <div className="border-t border-slate-900 pt-4 mt-4 flex justify-end space-x-2">
              <button
                onClick={onClose}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white rounded-lg text-xxs font-bold transition-colors"
              >
                Dismiss Stream
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

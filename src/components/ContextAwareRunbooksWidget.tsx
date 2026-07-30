import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { Incident } from '../types';

interface ContextAwareRunbooksWidgetProps {
  incident: Incident;
  onExecuteAction?: (actionName: string) => void;
}

interface SuggestedRunbook {
  id: string;
  title: string;
  matchScore: number;
  matchReason: string;
  category: string;
  estimatedResolutionTimeMins: number;
  steps: string[];
  actionCommand: string;
}

export const ContextAwareRunbooksWidget: React.FC<ContextAwareRunbooksWidgetProps> = ({
  incident,
  onExecuteAction
}) => {
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [executedIds, setExecutedIds] = useState<string[]>([]);

  // Dynamically compute top 3 suggested runbooks based on incident metadata
  const getSuggestedRunbooks = (inc: Incident): SuggestedRunbook[] => {
    const text = (inc.title + ' ' + inc.appName + ' ' + inc.description + ' ' + inc.logs.map(l => l.message).join(' ')).toLowerCase();

    const library: SuggestedRunbook[] = [
      {
        id: 'rb-k8s-oom',
        title: 'Kubernetes Container OOMKilled & Pod Limit Resize',
        matchScore: text.includes('oom') || text.includes('k8s') || text.includes('pod') || text.includes('137') ? 97 : 72,
        matchReason: 'Matched log signature "Exit Code 137 OOMKilled" & pod memory pressure',
        category: 'Kubernetes Cluster Ops',
        estimatedResolutionTimeMins: 8,
        steps: ['Inspect cgroup v2 memory throttle counter', 'Increase container limits by 512MiB', 'Rolling update deployment replicas'],
        actionCommand: 'kubectl set resources deployment/' + inc.appName.toLowerCase() + ' --limits=memory=2Gi'
      },
      {
        id: 'rb-pg-locks',
        title: 'PostgreSQL Lock Conflict & Long-Running Transaction Termination',
        matchScore: text.includes('lock') || text.includes('postgres') || text.includes('db') || text.includes('deadlock') ? 95 : 68,
        matchReason: 'Matched DB lock contention threshold (>5 uncommitted locks)',
        category: 'Database Infrastructure',
        estimatedResolutionTimeMins: 12,
        steps: ['Query pg_stat_activity for exclusive locks', 'Send pg_cancel_backend to blocking PID', 'Recycle active connection pool'],
        actionCommand: 'SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE state = "active";'
      },
      {
        id: 'rb-api-gateway',
        title: 'API Gateway Timeout & Webhook Proxy Circuit Breaker',
        matchScore: text.includes('timeout') || text.includes('gateway') || text.includes('504') || text.includes('webhook') ? 94 : 65,
        matchReason: 'Matched downstream HTTP 504 Gateway Timeout latency spike',
        category: 'API Gateway & Ingress',
        estimatedResolutionTimeMins: 6,
        steps: ['Trip circuit breaker for carrier endpoint', 'Flush ingress route cache', 'Enable automated fallback mock queue'],
        actionCommand: 'kubectl exec api-gateway -- cbr-cli trip --endpoint=carrier-api'
      },
      {
        id: 'rb-queue-backlog',
        title: 'RabbitMQ Consumer Scaling & Unacked Message Drain',
        matchScore: text.includes('queue') || text.includes('unacked') || text.includes('rabbitmq') || text.includes('backlog') ? 92 : 62,
        matchReason: 'Matched queue unacked message spike (>500 msgs)',
        category: 'Message Broker',
        estimatedResolutionTimeMins: 10,
        steps: ['Scale consumer workers count from 2 to 10', 'Re-queue deadletter items', 'Acknowledge processed batch telemetry'],
        actionCommand: 'rabbitmqctl set_policy consumer-scale "^task-" \'{"ha-mode":"all"}\''
      },
      {
        id: 'rb-auth-vault',
        title: 'Vault Token Refresh & OAuth JWT Lease Extension',
        matchScore: text.includes('auth') || text.includes('vault') || text.includes('token') || text.includes('401') ? 91 : 58,
        matchReason: 'Matched authorization token expiry log pattern',
        category: 'Security & Auth',
        estimatedResolutionTimeMins: 5,
        steps: ['Renew HashiCorp Vault root lease', 'Publish fresh JWT signing key', 'Trigger warm reload of client auth cache'],
        actionCommand: 'vault token renew -increment=1h'
      }
    ];

    // Sort descending by match score and return top 3
    return library.sort((a, b) => b.matchScore - a.matchScore).slice(0, 3);
  };

  const top3Runbooks = getSuggestedRunbooks(incident);

  const handleRun = (rb: SuggestedRunbook) => {
    setExecutingId(rb.id);
    setTimeout(() => {
      setExecutingId(null);
      setExecutedIds(prev => [...prev, rb.id]);
      if (onExecuteAction) {
        onExecuteAction(rb.actionCommand);
      }
    }, 1200);
  };

  return (
    <div className="bg-slate-900/80 border border-indigo-500/30 rounded-xl p-3.5 shadow-xl space-y-3 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
        <div className="flex items-center space-x-2">
          <div className="h-6 w-6 rounded bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
            <Icons.BookOpen className="h-3.5 w-3.5 text-indigo-400" />
          </div>
          <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider font-display">
            CONTEXT-AWARE RUNBOOK SUGGESTIONS
          </h4>
        </div>
        <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-bold">
          TOP 3 MATCHES
        </span>
      </div>

      <p className="text-[10px] text-slate-400 font-sans">
        Dynamically evaluated against <strong className="text-slate-200">{incident.appName}</strong> metadata &amp; log error signatures:
      </p>

      {/* Suggested Runbooks List */}
      <div className="space-y-2">
        {top3Runbooks.map((rb) => {
          const isExecuted = executedIds.includes(rb.id);
          const isExecuting = executingId === rb.id;

          return (
            <div
              key={rb.id}
              className="bg-slate-950/90 border border-slate-800 hover:border-indigo-500/50 rounded-lg p-2.5 transition-all space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                      {rb.matchScore}% MATCH
                    </span>
                    <span className="text-[9px] text-slate-500">{rb.category}</span>
                  </div>
                  <h5 className="text-xs font-sans font-semibold text-slate-100">{rb.title}</h5>
                </div>

                <div className="text-[9px] text-slate-400 text-right shrink-0">
                  <span className="text-indigo-400 font-bold">~{rb.estimatedResolutionTimeMins}m</span> res
                </div>
              </div>

              <p className="text-[9.5px] text-slate-400 font-sans italic bg-slate-900/60 p-1.5 rounded border border-slate-800/60">
                "{rb.matchReason}"
              </p>

              <div className="space-y-1">
                <span className="text-[9px] text-slate-500 font-bold uppercase">Automated Action Plan:</span>
                <ul className="text-[9.5px] text-slate-300 font-sans space-y-0.5 pl-3 list-disc">
                  {rb.steps.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>

              {/* Action Button */}
              <div className="pt-1 flex items-center justify-between border-t border-slate-900">
                <code className="text-[8.5px] text-slate-400 truncate max-w-[200px]" title={rb.actionCommand}>
                  {rb.actionCommand}
                </code>

                <button
                  onClick={() => handleRun(rb)}
                  disabled={isExecuting || isExecuted}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold flex items-center space-x-1 transition-all ${
                    isExecuted
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : isExecuting
                        ? 'bg-indigo-600 text-white animate-pulse'
                        : 'bg-indigo-600/80 hover:bg-indigo-500 text-white shadow-md'
                  }`}
                >
                  {isExecuting ? (
                    <>
                      <Icons.Loader2 className="h-3 w-3 animate-spin" />
                      <span>Executing...</span>
                    </>
                  ) : isExecuted ? (
                    <>
                      <Icons.CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      <span>Executed</span>
                    </>
                  ) : (
                    <>
                      <Icons.Play className="h-3 w-3 fill-current" />
                      <span>Run Action</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ContextAwareRunbooksWidget;

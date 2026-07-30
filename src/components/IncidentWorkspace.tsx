import React, { useState, useEffect, useRef } from 'react';
import { Incident, LogEntry, TimelineEvent, Tenant } from '../types';
import { InitialIncidents, SeedTenants } from '../data/simulation';
import * as Icons from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ComposedChart, Bar, Line, AreaChart, Area, Brush, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import IncidentDetailsDrawer from './IncidentDetailsDrawer';
import IncidentDependencyGraph from './IncidentDependencyGraph';
import { jsPDF } from 'jspdf';
import IncidentSummary from './IncidentSummary';
import { IncidentSummaryWidget } from './IncidentSummaryWidget';
import { VoiceTextInputWidget } from './VoiceTextInputWidget';
import { LogCorrelationChart } from './LogCorrelationChart';
import { IncidentD3Map } from './IncidentD3Map';
import { IncidentStickyNotes } from './IncidentStickyNotes';
import { VoiceCommandHistoryPanel } from './VoiceCommandHistoryPanel';
import { QuickIncidentTemplateSelector, IncidentTemplate } from './QuickIncidentTemplateSelector';
import Sev1SlaCountdownPanel from './Sev1SlaCountdownPanel';
import Incident24hTrendChart from './Incident24hTrendChart';
import ContextAwareRunbooksWidget from './ContextAwareRunbooksWidget';
import CorrelationSuggestionCard from './CorrelationSuggestionCard';
import InfrastructureNodeHeatmap from './InfrastructureNodeHeatmap';
import InteractiveIncidentTimeline from './InteractiveIncidentTimeline';

export const calculateSentimentScore = (incident: Incident): { score: number; label: string; color: string } => {
  let score = 70; // Base sentiment score (out of 100, where 100 is happy/neutral, and <50 is frustrated/angry)
  
  const textToAnalyze = (incident.description + " " + incident.title + " " + (incident.customerProfile || "")).toLowerCase();
  
  // Severe frustration triggers
  if (textToAnalyze.includes("unacceptable") || textToAnalyze.includes("terrible") || textToAnalyze.includes("furious") || textToAnalyze.includes("angry")) score -= 35;
  if (textToAnalyze.includes("frustrated") || textToAnalyze.includes("broken") || textToAnalyze.includes("down") || textToAnalyze.includes("failing")) score -= 15;
  if (textToAnalyze.includes("urgent") || textToAnalyze.includes("asap") || textToAnalyze.includes("immediate") || textToAnalyze.includes("sla")) score -= 15;
  if (textToAnalyze.includes("blocking") || textToAnalyze.includes("critical") || textToAnalyze.includes("crashed")) score -= 10;
  if (textToAnalyze.includes("error") || textToAnalyze.includes("fail") || textToAnalyze.includes("failed")) score -= 5;
  
  // Analyze log entries as well for error/fatal ratios
  const logs = incident.logs || [];
  const errorLogs = logs.filter(l => l.level === 'ERROR' || l.level === 'FATAL').length;
  if (errorLogs > 3) {
    score -= 15;
  } else if (errorLogs > 0) {
    score -= 5;
  }
  
  // Solved tickets restore sentiment
  if (incident.status === 'SOLVED') {
    score = Math.min(100, score + 40);
  }
  
  // Clamp score
  score = Math.max(10, Math.min(100, score));
  
  // Map score to label/color
  if (score < 40) {
    return { score, label: "Critical Frustration", color: "text-rose-400 bg-rose-500/10 border-rose-500/20" };
  } else if (score < 65) {
    return { score, label: "Agitated", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
  } else if (score < 85) {
    return { score, label: "Neutral / Concerned", color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" };
  } else {
    return { score, label: "Satisfied / Restored", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
  }
};

export const getIncidentTags = (incident: Incident): string[] => {
  const tags: string[] = [];
  if (incident.appName) tags.push(incident.appName);
  if (incident.severity) tags.push(incident.severity);
  if (incident.cloudProvider) {
    tags.push(incident.cloudProvider);
  } else {
    if (incident.id.includes('001') || incident.id.includes('004') || incident.appName.includes('Billing')) tags.push('AWS');
    else if (incident.id.includes('002') || incident.appName.includes('PCI')) tags.push('GCP');
    else tags.push('Azure');
  }

  if (incident.environment) {
    tags.push(incident.environment);
  } else {
    tags.push('Production');
  }

  if (incident.tags && incident.tags.length > 0) {
    tags.push(...incident.tags);
  } else {
    const text = (incident.title + " " + incident.description).toLowerCase();
    if (text.includes('oom') || text.includes('memory') || text.includes('heap')) tags.push('OOMKilled');
    if (text.includes('lock') || text.includes('postgres') || text.includes('deadlock')) tags.push('Database Lock');
    if (text.includes('502') || text.includes('gateway') || text.includes('checkout')) tags.push('502 Gateway');
    if (text.includes('webhook') || text.includes('http') || text.includes('timeout')) tags.push('Webhook Congestion');
    if (text.includes('redis') || text.includes('cache')) tags.push('Cache Eviction');
    if (text.includes('ssl') || text.includes('tls') || text.includes('cert')) tags.push('SSL Expiry');
  }

  return Array.from(new Set(tags));
};

const REPLY_TEMPLATES = [
  {
    name: "Acknowledgment & Initial Triage",
    text: "Hi there, thank you for reaching out. We have detected anomalous behavior affecting your workspace and have raised a high-priority ticket. Our on-call engineering squad is actively diagnosing the root cause. We will provide updates here every 15 minutes as we work toward mitigation. Thank you for your patience."
  },
  {
    name: "Mitigation & Hotfix Deployment",
    text: "Hello, our engineering team has isolated the issue to a microservice degradation. We are currently executing remediation actions and deploying a hotfix. Services should begin recovering shortly. We are monitoring live telemetry closely to ensure stable transaction paths. Another update will follow in 10 minutes."
  },
  {
    name: "Complete Service Restoration",
    text: "Greetings, we are pleased to report that the underlying infrastructure issue has been successfully resolved and full service has been restored. All health checks are now green, and system latency has returned to baseline levels. We will keep this ticket open for a brief observation period to ensure absolute stability. Please let us know if you experience any further discrepancies."
  },
  {
    name: "Detailed Root Cause & Post-Mortem",
    text: "Thank you for your patience. The incident has been mitigated. The root cause was identified as memory heap exhaustion under an unexpected payload spike, resulting in an OOM termination. We have scaled our container resources, adjusted the garbage collection thresholds, and updated our alert configurations. A formal post-mortem document will be shared with your account team. Thank you."
  }
];

const historicalSeverityData = [
  { name: 'Feb', P0: 4, P1: 12, P2: 24, P3: 45 },
  { name: 'Mar', P0: 6, P1: 15, P2: 30, P3: 52 },
  { name: 'Apr', P0: 3, P1: 18, P2: 28, P3: 40 },
  { name: 'May', P0: 8, P1: 22, P2: 35, P3: 61 },
  { name: 'Jun', P0: 5, P1: 14, P2: 27, P3: 48 },
  { name: 'Jul', P0: 10, P1: 25, P2: 42, P3: 70 }
];

const legendTrendData = {
  '7days': [
    { name: 'Mon', P0: 1, P1: 2, P2: 4, P3: 8 },
    { name: 'Tue', P0: 0, P1: 3, P2: 5, P3: 10 },
    { name: 'Wed', P0: 2, P1: 1, P2: 3, P3: 7 },
    { name: 'Thu', P0: 1, P1: 4, P2: 6, P3: 12 },
    { name: 'Fri', P0: 3, P1: 2, P2: 4, P3: 9 },
    { name: 'Sat', P0: 0, P1: 1, P2: 2, P3: 5 },
    { name: 'Sun', P0: 1, P1: 0, P2: 3, P3: 4 }
  ],
  '30days': [
    { name: 'Wk 1', P0: 3, P1: 10, P2: 18, P3: 35 },
    { name: 'Wk 2', P0: 4, P1: 8, P2: 22, P3: 40 },
    { name: 'Wk 3', P0: 2, P1: 12, P2: 15, P3: 30 },
    { name: 'Wk 4', P0: 5, P1: 15, P2: 25, P3: 45 }
  ],
  'ytd': [
    { name: 'Jan', P0: 2, P1: 10, P2: 20, P3: 38 },
    { name: 'Feb', P0: 4, P1: 12, P2: 24, P3: 45 },
    { name: 'Mar', P0: 6, P1: 15, P2: 30, P3: 52 },
    { name: 'Apr', P0: 3, P1: 18, P2: 28, P3: 40 },
    { name: 'May', P0: 8, P1: 22, P2: 35, P3: 61 },
    { name: 'Jun', P0: 5, P1: 14, P2: 27, P3: 48 },
    { name: 'Jul', P0: 10, P1: 25, P2: 42, P3: 70 }
  ]
};

const calculateIncidentForecast = () => {
  // Historical incidents count per cycle: Cycle 1=4, Cycle 2=6, Cycle 3=3, Cycle 4=8, Cycle 5=5, Cycle 6=11
  const history = [
    { cycle: 1, count: 4, label: "06:00" },
    { cycle: 2, count: 6, label: "12:00" },
    { cycle: 3, count: 3, label: "18:00" },
    { cycle: 4, count: 8, label: "00:00" },
    { cycle: 5, count: 5, label: "06:00" },
    { cycle: 6, count: 11, label: "12:00" }
  ];

  // Simple Linear Regression: y = mx + b
  const n = history.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += history[i].cycle;
    sumY += history[i].count;
    sumXY += history[i].cycle * history[i].count;
    sumXX += history[i].cycle * history[i].cycle;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Project next 3 cycles (e.g., next 18 hours)
  const projections = [];
  for (let i = 1; i <= 3; i++) {
    const projectedCycle = n + i;
    const projectedCount = Math.max(0, parseFloat((slope * projectedCycle + intercept).toFixed(1)));
    
    let timeLabel = "";
    if (i === 1) timeLabel = "+6 Hours";
    else if (i === 2) timeLabel = "+12 Hours";
    else if (i === 3) timeLabel = "+18 Hours";

    // Capacity Bottleneck / Risk Level assessment
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    let bottleneckSource = 'None';
    if (projectedCount > 13) {
      riskLevel = 'CRITICAL';
      bottleneckSource = 'Kafka Partition lag / Network Socket Exhaustion';
    } else if (projectedCount > 9) {
      riskLevel = 'HIGH';
      bottleneckSource = 'PostgreSQL Connection Exhaustion / PG Pool Starvation';
    } else if (projectedCount > 6) {
      riskLevel = 'MEDIUM';
      bottleneckSource = 'Redis eviction spikes';
    }

    projections.push({
      cycle: projectedCycle,
      projectedCount,
      timeLabel,
      riskLevel,
      bottleneckSource
    });
  }

  return { history, slope, projections };
};

export type ErrorPatternType = 'TIMEOUT' | 'CONN_RESET' | 'MEMORY_OOM' | 'FATAL_5XX' | 'AUTH_4XX' | 'NONE';

export function detectLogErrorPattern(message: string, level?: string): ErrorPatternType {
  const msgLower = message.toLowerCase();
  if (msgLower.includes('timeout') || msgLower.includes('etimedout') || msgLower.includes('gateway timeout') || msgLower.includes('deadline exceeded') || msgLower.includes('sockettimeout')) {
    return 'TIMEOUT';
  }
  if (msgLower.includes('connection reset') || msgLower.includes('econnreset') || msgLower.includes('connection refused') || msgLower.includes('socket hang up') || msgLower.includes('broken pipe') || msgLower.includes('econnrefused')) {
    return 'CONN_RESET';
  }
  if (msgLower.includes('oom') || msgLower.includes('oomkilled') || msgLower.includes('out of memory') || msgLower.includes('heap limit') || msgLower.includes('memory eviction') || msgLower.includes('memory leak') || msgLower.includes('heap usage elevated')) {
    return 'MEMORY_OOM';
  }
  if (msgLower.includes('500') || msgLower.includes('502') || msgLower.includes('503') || msgLower.includes('504') || msgLower.includes('deadlock') || msgLower.includes('fatal') || msgLower.includes('panic') || level === 'FATAL') {
    return 'FATAL_5XX';
  }
  if (msgLower.includes('401') || msgLower.includes('403') || msgLower.includes('unauthorized') || msgLower.includes('forbidden') || msgLower.includes('jwt expired') || msgLower.includes('permission denied')) {
    return 'AUTH_4XX';
  }
  return 'NONE';
}

export const ERROR_PATTERN_META: Record<ErrorPatternType, { label: string; borderClass: string; bgClass: string; badgeClass: string; textClass: string }> = {
  TIMEOUT: {
    label: 'Timeout Pattern',
    borderClass: 'border-l-4 border-l-amber-500 border-amber-500/40',
    bgClass: 'bg-amber-950/25',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    textClass: 'text-amber-300'
  },
  CONN_RESET: {
    label: 'Connection Reset',
    borderClass: 'border-l-4 border-l-cyan-500 border-cyan-500/40',
    bgClass: 'bg-cyan-950/25',
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    textClass: 'text-cyan-300'
  },
  MEMORY_OOM: {
    label: 'OOM / Memory',
    borderClass: 'border-l-4 border-l-purple-500 border-purple-500/40',
    bgClass: 'bg-purple-950/25',
    badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    textClass: 'text-purple-300'
  },
  FATAL_5XX: {
    label: '5xx / Fatal',
    borderClass: 'border-l-4 border-l-rose-500 border-rose-500/40',
    bgClass: 'bg-rose-950/25',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    textClass: 'text-rose-300'
  },
  AUTH_4XX: {
    label: 'Auth / 4xx',
    borderClass: 'border-l-4 border-l-orange-500 border-orange-500/40',
    bgClass: 'bg-orange-950/25',
    badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    textClass: 'text-orange-300'
  },
  NONE: {
    label: 'Standard',
    borderClass: 'border-l-2 border-l-slate-800',
    bgClass: '',
    badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
    textClass: 'text-slate-300'
  }
};

function highlightLogMessage(message: string): React.ReactNode {
  // Regex capturing key error/telemetry patterns
  const regex = /\b(CRITICAL|FATAL|Timeout|Connection Reset|ECONNRESET|ETIMEDOUT|OOMKilled|OOM|Deadlock|502 Bad Gateway|Socket Hang Up|ERROR|Failed|Exception|WARN|WARNING|SUCCESS|OK)\b/gi;
  const parts = message.split(regex);
  if (parts.length === 1) return <span>{message}</span>;

  return (
    <span>
      {parts.map((part, index) => {
        const lower = part.toLowerCase();
        if (lower === 'critical' || lower === 'fatal' || lower === '502 bad gateway' || lower === 'deadlock') {
          return (
            <span key={index} className="text-rose-400 font-extrabold bg-rose-950/40 px-1 rounded border border-rose-500/20">
              {part}
            </span>
          );
        }
        if (lower === 'connection reset' || lower === 'econnreset' || lower === 'socket hang up') {
          return (
            <span key={index} className="text-cyan-300 font-bold bg-cyan-950/40 px-1 rounded border border-cyan-500/30">
              {part}
            </span>
          );
        }
        if (lower === 'oomkilled' || lower === 'oom') {
          return (
            <span key={index} className="text-purple-300 font-bold bg-purple-950/40 px-1 rounded border border-purple-500/30">
              {part}
            </span>
          );
        }
        if (lower === 'error' || lower === 'failed' || lower === 'exception') {
          return (
            <span key={index} className="text-red-400 font-bold underline decoration-rose-500/30">
              {part}
            </span>
          );
        }
        if (lower === 'timeout' || lower === 'etimedout' || lower === 'warn' || lower === 'warning') {
          return (
            <span key={index} className="text-amber-400 font-semibold bg-amber-500/10 px-0.5 rounded">
              {part}
            </span>
          );
        }
        if (lower === 'success' || lower === 'ok') {
          return (
            <span key={index} className="text-emerald-400 font-bold">
              {part}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}

function IncidentLifecycleTimeline({ incident }: { incident: Incident }) {
  const baseTime = new Date(incident.createdAt).getTime();

  const stages = [
    {
      id: 'DETECTED',
      label: 'Detected',
      time: new Date(baseTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      offset: '+0m',
      status: 'COMPLETED',
      icon: Icons.AlertTriangle,
      color: 'rose',
      title: 'Automated Telemetry Anomaly Detected',
      description: `Service monitor triggered alert for ${incident.appName} due to high failure rate and elevated response latencies.`,
      logEvidence: (incident.logs && incident.logs.length > 0) ? incident.logs[0].message : 'Pod monitor detected threshold breach'
    },
    {
      id: 'INVESTIGATING',
      label: 'Investigating',
      time: new Date(baseTime + 120000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      offset: '+2.0m',
      status: incident.status === 'OPEN' || incident.status === 'INVESTIGATING' || incident.status === 'SOLVED' ? 'COMPLETED' : 'PENDING',
      icon: Icons.Search,
      color: 'amber',
      title: 'AI Root Cause Agent & L3 Engineer Dispatched',
      description: `Assigned to ${incident.assignee || 'Eshan Barua'}. Deep log correlation engine dispatched Jaeger distributed traces and db lock analysis.`,
      logEvidence: (incident.logs && incident.logs.length > 1) ? incident.logs[1].message : 'Distributed Jaeger trace correlation initiated'
    },
    {
      id: 'ESCALATED',
      label: 'Escalated',
      time: new Date(baseTime + 495000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      offset: '+8.25m',
      status: incident.severity === 'CRITICAL' ? 'COMPLETED' : 'IN_PROGRESS',
      icon: Icons.ArrowUpRight,
      color: 'indigo',
      title: 'P0 Executive Bridge Escalation Active',
      description: `SLA timer remaining threshold reached. Incident severity set to ${incident.severity}. Cross-functional war room assembled.`,
      logEvidence: (incident.logs && incident.logs.length > 2) ? incident.logs[2].message : 'PagerDuty P0 escalation page sent to infrastructure lead'
    },
    {
      id: 'RESOLVED',
      label: 'Resolved',
      time: incident.status === 'SOLVED' 
        ? new Date(baseTime + 1500000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : 'Pending Recovery',
      offset: incident.status === 'SOLVED' ? '+25.0m' : 'In Progress',
      status: incident.status === 'SOLVED' ? 'COMPLETED' : 'IN_PROGRESS',
      icon: Icons.CheckCircle2,
      color: incident.status === 'SOLVED' ? 'emerald' : 'slate',
      title: incident.status === 'SOLVED' ? 'Root Cause Remediated & Service Restored' : 'Remediation Playbook Executing',
      description: incident.status === 'SOLVED' 
        ? 'Remediation actions confirmed. Connection pool recycled, pod memory limits resized, and SLA verification passed.'
        : 'Automated remediation playbook in progress. Awaiting telemetry health verification.',
      logEvidence: incident.status === 'SOLVED' ? 'Service health check returned 200 OK across 100% of canary replicas' : 'Awaiting final SLA handshake'
    }
  ];

  return (
    <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 space-y-3.5 my-2">
      <div className="flex items-center justify-between border-b border-slate-800/50 pb-2.5">
        <div className="flex items-center space-x-2">
          <Icons.GitCommit className="h-4 w-4 text-indigo-400" />
          <span className="font-display font-bold text-xs text-white uppercase tracking-wider">Vertical Incident Lifecycle Timeline</span>
        </div>
        <span className="text-[9px] font-mono text-slate-400 font-bold bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
          Active Lifecycle Phase: {incident.status}
        </span>
      </div>

      <div className="relative pl-6 space-y-4 border-l-2 border-indigo-500/30 ml-2 py-1">
        {stages.map((stg) => {
          const Icon = stg.icon;
          const isDone = stg.status === 'COMPLETED';
          return (
            <div key={stg.id} className="relative group">
              {/* Node Bullet */}
              <div className={`absolute -left-[31px] top-0.5 h-6 w-6 rounded-full flex items-center justify-center border text-xs shadow-md ${
                isDone 
                  ? stg.color === 'rose' ? 'bg-rose-950 border-rose-500 text-rose-400'
                  : stg.color === 'amber' ? 'bg-amber-950 border-amber-500 text-amber-400'
                  : stg.color === 'emerald' ? 'bg-emerald-950 border-emerald-500 text-emerald-400'
                  : 'bg-indigo-950 border-indigo-500 text-indigo-400'
                  : 'bg-slate-900 border-slate-700 text-slate-500'
              }`}>
                <Icon className="h-3 w-3" />
              </div>

              {/* Stage Card */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 hover:border-indigo-500/40 transition-all space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xxs font-extrabold uppercase text-slate-200 tracking-wider">{stg.label}</span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-slate-950 text-slate-400 border border-slate-800">
                      {stg.offset}
                    </span>
                  </div>
                  <span className="font-mono text-[9px] text-slate-500">{stg.time}</span>
                </div>

                <div className="font-sans text-xxs font-semibold text-slate-300">{stg.title}</div>
                <p className="font-sans text-[10px] text-slate-400 leading-relaxed">{stg.description}</p>

                <div className="bg-slate-950/80 border border-slate-800/60 rounded px-2.5 py-1 font-mono text-[9px] text-slate-400 flex items-center space-x-2 mt-1">
                  <span className="text-indigo-400 font-bold shrink-0">Log Evidence:</span>
                  <span className="truncate text-slate-300">{stg.logEvidence}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface IncidentWorkspaceProps {
  modelSelection: string;
  onAddAuditLog: (operator: string, action: string, module: string, status: 'SUCCESS' | 'FAILED' | 'PENDING_APPROVAL', payload: string) => void;
}

export default function IncidentWorkspace({ modelSelection, onAddAuditLog }: IncidentWorkspaceProps) {
  const [incidents, setIncidents] = useState<Incident[]>(InitialIncidents);
  const [selectedIncident, setSelectedIncident] = useState<Incident>(InitialIncidents[0]);
  
  const getSlaDetails = (incident: Incident) => {
    const limitMins = incident.slaLimitMins || (incident.severity === 'CRITICAL' ? 30 : incident.severity === 'HIGH' ? 60 : 120);
    const createdTime = new Date(incident.createdAt).getTime();
    const targetTime = createdTime + limitMins * 60 * 1000;
    const remainingMs = targetTime - liveNow;
    
    const isBreached = remainingMs <= 0;
    const absDiff = Math.abs(remainingMs);
    
    const hrs = Math.floor(absDiff / (3600 * 1000));
    const mins = Math.floor((absDiff % (3600 * 1000)) / (60 * 1000));
    const secs = Math.floor((absDiff % (60 * 1000)) / 1000);
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    const formatted = `${hrs > 0 ? `${hrs}:` : ''}${pad(mins)}:${pad(secs)}`;
    
    return {
      limitMins,
      isBreached,
      formatted,
      remainingMs,
      percentage: Math.max(0, Math.min(100, (remainingMs / (limitMins * 60 * 1000)) * 100))
    };
  };
  const [drawerIncidentId, setDrawerIncidentId] = useState<string | null>(null);

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIncidentIds, setSelectedIncidentIds] = useState<string[]>([]);
  const [isSeverityLegendOpen, setIsSeverityLegendOpen] = useState(false);
  const [priorityOnly, setPriorityOnly] = useState(false);

  const [copiedId, setCopiedId] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'P0' | 'P1' | 'P2' | 'P3'>('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL');
  const [groupBy, setGroupBy] = useState<'NONE' | 'SERVICE' | 'PRIORITY' | 'AGENT'>('NONE');
  const [legendTimePeriod, setLegendTimePeriod] = useState<'7days' | '30days' | 'ytd'>('ytd');
  const [timePeriodFilter, setTimePeriodFilter] = useState<'ALL' | '7days' | '30days' | 'ytd'>('ALL');

  const isWithinPeriod = (createdAtStr: string, period: 'ALL' | '7days' | '30days' | 'ytd') => {
    if (period === 'ALL') return true;
    const createdDate = new Date(createdAtStr);
    const currentDate = new Date('2026-07-19T03:17:26-07:00');
    const diffTime = currentDate.getTime() - createdDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (period === '7days') {
      return diffDays <= 7 && diffDays >= 0;
    }
    if (period === '30days') {
      return diffDays <= 30 && diffDays >= 0;
    }
    if (period === 'ytd') {
      return createdDate.getFullYear() === 2026 && createdDate <= currentDate;
    }
    return true;
  };

  const [autoScrollLogs, setAutoScrollLogs] = useState(true);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Operator user context
  const LOGGED_IN_USER = "Eshan Barua (CTO)";

  // Resolution Codes for Quick Resolution Wizard
  const RESOLUTION_CODES = [
    { code: 'RES-101', label: 'CODE_HOTFIX_DEPLOYED', desc: 'Application bug resolved via code patch or emergency hotfix.' },
    { code: 'RES-102', label: 'INFRA_FAILOVER_EXECUTED', desc: 'Infrastructure or node failed over to secondary backup cluster.' },
    { code: 'RES-103', label: 'DB_INDEX_OPTIMIZED', desc: 'Database query optimized or exclusive lock starvation cleared.' },
    { code: 'RES-104', label: 'RATE_LIMIT_CONFIGURED', desc: 'Throttling/rate-limiting enabled for offending client IP or route.' },
    { code: 'RES-105', label: 'REVERTED_FEATURE_FLAG', desc: 'Problematic feature flag or configuration toggle reverted.' },
    { code: 'RES-106', label: 'THIRD_PARTY_RESTORED', desc: 'Upstream third-party API or provider service recovered.' },
    { code: 'RES-199', label: 'OTHER_WORKAROUND', desc: 'Operational workaround applied by engineer on duty.' }
  ];

  // Quick Resolution Wizard State
  const [isQuickResolutionOpen, setIsQuickResolutionOpen] = useState(false);
  const [resolutionRootCause, setResolutionRootCause] = useState('');
  const [resolutionCode, setResolutionCode] = useState('RES-101');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionIncidentTarget, setResolutionIncidentTarget] = useState<Incident | null>(null);

  // Drag-and-Drop Sidebar Queue Reordering State
  const [draggedIncidentId, setDraggedIncidentId] = useState<string | null>(null);
  const [dragOverIncidentId, setDragOverIncidentId] = useState<string | null>(null);

  // Real-time Log Streaming WebSocket State
  const [isLiveStreaming, setIsLiveStreaming] = useState(false);
  const [streamRxCount, setStreamRxCount] = useState(0);

  // New features state
  const [suggestedFilters, setSuggestedFilters] = useState<string[]>([]);
  const [isSuggestingFilters, setIsSuggestingFilters] = useState(false);
  const [customActionableInsights, setCustomActionableInsights] = useState<Array<{ id: string; text: string; timestamp: string; logLine: string; incidentId: string }>>([
    {
      id: 'ins-1',
      text: 'Candidate Root Cause: PostgreSQL exclusive lock starvation on table `orders`',
      timestamp: new Date().toISOString(),
      logLine: 'Connection pool exhausted: 50/50 blocked by DB lock',
      incidentId: InitialIncidents[0].id
    }
  ]);
  const [insightInputIndex, setInsightInputIndex] = useState<number | null>(null);
  const [insightText, setInsightText] = useState<string>('');

  // Open Quick Resolution Wizard
  const handleOpenQuickResolution = (inc?: Incident) => {
    const target = inc || selectedIncident;
    setResolutionIncidentTarget(target);
    setResolutionRootCause(target.analysis?.rootCause || target.description || '');
    setResolutionCode('RES-101');
    setResolutionNotes('');
    setIsQuickResolutionOpen(true);
  };

  // Confirm and Execute Quick Resolution
  const handleConfirmResolution = () => {
    if (!resolutionIncidentTarget) return;
    if (!resolutionRootCause.trim()) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: 'Please enter a root-cause summary before archiving.' }
      }));
      return;
    }

    const updatedInc: Incident = {
      ...resolutionIncidentTarget,
      status: 'SOLVED',
      lastModifiedBy: LOGGED_IN_USER,
      csatScore: 98,
      statusHistory: [
        ...getStatusHistory(resolutionIncidentTarget),
        {
          status: 'SOLVED',
          timestamp: new Date().toISOString(),
          changedBy: LOGGED_IN_USER,
          message: `[Quick Resolution ${resolutionCode}] Root Cause: ${resolutionRootCause.trim()}${resolutionNotes ? ` | Notes: ${resolutionNotes.trim()}` : ''}`
        }
      ]
    };

    setIncidents(prev => prev.map(i => i.id === updatedInc.id ? updatedInc : i));
    if (selectedIncident.id === updatedInc.id) {
      setSelectedIncident(updatedInc);
    }

    if (onAddAuditLog) {
      onAddAuditLog(
        LOGGED_IN_USER,
        'Quick Resolution & Archive',
        'IncidentWorkspace',
        'SUCCESS',
        `Resolved & archived ${updatedInc.id} with resolution code ${resolutionCode}. Root cause: "${resolutionRootCause.trim()}"`
      );
    }

    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message: `Incident ${updatedInc.id} resolved & archived with code ${resolutionCode}.` }
    }));

    setIsQuickResolutionOpen(false);
  };

  // 'Assign to Me' handler for SEV-1 / SEV-2 incidents
  const handleAssignToMe = (targetInc?: Incident) => {
    const target = targetInc || selectedIncident;
    const updatedInc: Incident = {
      ...target,
      assignee: LOGGED_IN_USER,
      lastModifiedBy: LOGGED_IN_USER,
      statusHistory: [
        ...getStatusHistory(target),
        {
          status: target.status,
          timestamp: new Date().toISOString(),
          changedBy: LOGGED_IN_USER,
          message: `Claimed ${target.severity} incident directly via Assign to Me button.`
        }
      ]
    };

    setIncidents(prev => prev.map(i => i.id === updatedInc.id ? updatedInc : i));
    if (selectedIncident.id === updatedInc.id) {
      setSelectedIncident(updatedInc);
    }

    if (onAddAuditLog) {
      onAddAuditLog(
        LOGGED_IN_USER,
        'Claim Incident',
        'IncidentWorkspace',
        'SUCCESS',
        `Claimed ${updatedInc.severity} incident ${updatedInc.id} directly in workspace view.`
      );
    }

    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message: `Incident ${updatedInc.id} claimed & assigned to ${LOGGED_IN_USER}.` }
    }));
  };

  // Sidebar Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIncidentId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIncidentId !== id) {
      setDragOverIncidentId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = draggedIncidentId || e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) {
      setDraggedIncidentId(null);
      setDragOverIncidentId(null);
      return;
    }

    setIncidents(prev => {
      const sourceIdx = prev.findIndex(i => i.id === sourceId);
      const targetIdx = prev.findIndex(i => i.id === targetId);
      if (sourceIdx === -1 || targetIdx === -1) return prev;

      const updated = [...prev];
      const [moved] = updated.splice(sourceIdx, 1);
      updated.splice(targetIdx, 0, moved);

      if (onAddAuditLog) {
        onAddAuditLog(
          LOGGED_IN_USER,
          'Reorder Queue',
          'IncidentWorkspace',
          'SUCCESS',
          `Reordered active incident processing queue: Moved ${sourceId} to position #${targetIdx + 1}`
        );
      }

      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: `Queue position reordered: ${sourceId} moved to position #${targetIdx + 1}` }
      }));

      return updated;
    });

    setDraggedIncidentId(null);
    setDragOverIncidentId(null);
  };

  const handleDragEnd = () => {
    setDraggedIncidentId(null);
    setDragOverIncidentId(null);
  };

  // Real-time WebSocket Log Streaming Effect
  useEffect(() => {
    if (!isLiveStreaming) return;

    const sampleLogTemplates = [
      { level: 'INFO', msg: `Node ping /healthz returned 200 OK (latency: 3.2ms)` },
      { level: 'DEBUG', msg: `WebSocket RPC frame ACK received for node ${selectedIncident.appName.toLowerCase()}-01` },
      { level: 'INFO', msg: `Connection pool active: 18/50 connections allocated` },
      { level: 'WARN', msg: `Memory heap usage elevated (82%) on worker thread #3` },
      { level: 'INFO', msg: `Ingress router HTTP GET /api/v1/telemetry 200 OK (12ms)` },
      { level: 'ERROR', msg: `SocketTimeoutException on internal RPC handshake (retrying 1/3)` },
      { level: 'INFO', msg: `Service telemetry sweep completed across 10/10 nodes` }
    ];

    const interval = setInterval(() => {
      const sample = sampleLogTemplates[Math.floor(Math.random() * sampleLogTemplates.length)];
      const newLog = {
        timestamp: new Date().toISOString(),
        level: sample.level as any,
        source: `${selectedIncident.appName.toLowerCase()}-live-ws`,
        message: `${sample.msg} [Rx #${streamRxCount + 1}]`
      };

      setSelectedIncident(prev => ({
        ...prev,
        logs: [...prev.logs, newLog]
      }));

      setIncidents(prev => prev.map(inc => inc.id === selectedIncident.id ? {
        ...inc,
        logs: [...inc.logs, newLog]
      } : inc));

      setStreamRxCount(c => c + 1);

      if (autoScrollLogs && logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [isLiveStreaming, selectedIncident.id, autoScrollLogs, streamRxCount]);

  // Call Gemini API to suggest relevant log query filters
  const handleSuggestLogFilters = async () => {
    try {
      setIsSuggestingFilters(true);
      const res = await fetch('/api/suggest-log-filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logs: selectedIncident.logs,
          appName: selectedIncident.appName,
          severity: selectedIncident.severity
        })
      });

      if (!res.ok) throw new Error('Failed to fetch suggested filters');
      const data = await res.json();
      if (data && Array.isArray(data.filters)) {
        setSuggestedFilters(data.filters);
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: { message: `Gemini proposed ${data.filters.length} log filters.` }
        }));
      }
    } catch (err: any) {
      console.error('Suggest Log Filters error:', err);
      setSuggestedFilters(['level:ERROR', `source:${selectedIncident.appName.toLowerCase()}`, 'timeout', 'exception']);
    } finally {
      setIsSuggestingFilters(false);
    }
  };

  // Add actionable insight label to selected log segment
  const handleAddActionableInsight = (logMessage: string) => {
    if (!insightText.trim()) return;
    const newInsight = {
      id: `insight-${Date.now()}`,
      text: insightText.trim(),
      timestamp: new Date().toISOString(),
      logLine: logMessage,
      incidentId: selectedIncident.id
    };

    setCustomActionableInsights(prev => [newInsight, ...prev]);
    setInsightText('');
    setInsightInputIndex(null);

    if (onAddAuditLog) {
      onAddAuditLog('Operator', 'Attach Actionable Insight', 'LogConsole', 'SUCCESS', `Attached Actionable Insight to ${selectedIncident.id}: "${newInsight.text}"`);
    }

    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message: `Actionable Insight attached and saved to audit trail.` }
    }));
  };

  // Download PDF Report for active incident
  const handleDownloadReport = () => {
    try {
      const doc = new jsPDF();
      const inc = selectedIncident;

      // Header Banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 32, 'F');

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(`INCIDENT INVESTIGATION REPORT: ${inc.id}`, 14, 18);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(`Generated: ${new Date().toLocaleString()} | SupportPilot Ops Workspace`, 14, 25);

      // Metadata Cards
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text("1. Incident Summary & Status", 14, 42);

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Title: ${inc.title}`, 14, 50);
      doc.text(`Application / Service: ${inc.appName}`, 14, 57);
      doc.text(`Severity Level: ${inc.severity}  |  Status: ${inc.status}`, 14, 64);
      doc.text(`Assigned Engineer: ${inc.assignee || 'Unassigned'}`, 14, 71);
      doc.text(`Created Timestamp: ${inc.createdAt}`, 14, 78);

      // Description & Telemetry Findings
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text("2. Telemetry Findings & Impact Assessment", 14, 90);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      const descLines = doc.splitTextToSize(inc.description || 'Active operational incident analyzed by automated agents.', 180);
      doc.text(descLines, 14, 97);

      let yPos = 97 + descLines.length * 5 + 8;

      // Actionable Insights
      const activeInsights = customActionableInsights.filter(i => i.incidentId === inc.id);
      if (activeInsights.length > 0) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text("3. Actionable Operator Insights", 14, yPos);
        yPos += 7;

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        activeInsights.forEach(ins => {
          doc.text(`\u2022 [${new Date(ins.timestamp).toLocaleTimeString()}] ${ins.text}`, 16, yPos);
          yPos += 5;
        });
        yPos += 5;
      }

      // Associated Log Stream
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text("4. Key Correlated Logs", 14, yPos);
      yPos += 7;

      doc.setFontSize(7.5);
      doc.setFont('courier', 'normal');
      inc.logs.slice(0, 12).forEach((log) => {
        const logStr = `[${log.level}] (${log.source}): ${log.message}`;
        const splitLog = doc.splitTextToSize(logStr, 180);
        doc.text(splitLog, 14, yPos);
        yPos += splitLog.length * 4.5;
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
      });

      doc.save(`Incident_Report_${inc.id}.pdf`);

      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: `Downloaded PDF investigation report for ${inc.id}` }
      }));
    } catch (err: any) {
      console.error('PDF export error:', err);
    }
  };

  const [quickNote, setQuickNote] = useState('');
  
  const [pendingBulkAction, setPendingBulkAction] = useState<{
    type: 'ASSIGN' | 'STATUS' | 'REPRIORITIZE' | 'RESOLVE_ALL';
    value: string;
    targetIds: string[];
  } | null>(null);
  
  const [isAutoRefreshActive, setIsAutoRefreshActive] = useState(false);
  const [comparePrevious, setComparePrevious] = useState(false);

  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const servicesList = Array.from(new Set(incidents.map(i => i.appName).filter(Boolean)));

  // Dynamic Tag Filtering State
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<'ANY' | 'ALL'>('ANY');
  const [tagSearchQuery, setTagSearchQuery] = useState<string>('');
  const [isTagDrawerOpen, setIsTagDrawerOpen] = useState<boolean>(false);

  // Priority Sorting State
  const [sortByPriority, setSortByPriority] = useState<boolean>(false);

  // Log Error Pattern Filter State
  const [activePatternFilter, setActivePatternFilter] = useState<ErrorPatternType | 'ALL'>('ALL');

  // AI Root Cause Analysis State
  const [isRcaLoading, setIsRcaLoading] = useState<boolean>(false);
  const [rcaResult, setRcaResult] = useState<{
    summary: string;
    rootCause: string;
    evidence: string[];
    suggestedFix: string;
    confidence: number;
    timestamp: string;
  } | null>(null);
  const [isRcaCollapsed, setIsRcaCollapsed] = useState<boolean>(false);

  // AI Root Cause Analysis Trigger Handler
  const handleRunRootCauseAnalysis = async (targetInc?: Incident) => {
    const inc = targetInc || selectedIncident;
    if (!inc) return;
    setIsRcaLoading(true);
    setIsRcaCollapsed(false);
    try {
      const res = await fetch('/api/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident: inc, modelSelection })
      });
      if (!res.ok) throw new Error('RCA investigation failed');
      const data = await res.json();
      setRcaResult({
        summary: data.summary || data.rootCause || "AI analysis completed successfully.",
        rootCause: data.rootCause || "Log telemetry indicates database connection starvation and resource locking under peak load.",
        evidence: inc.logs.length > 0 ? inc.logs.slice(0, 3).map(l => `[${l.timestamp.slice(11, 19)}] (${l.level}): ${l.message}`) : ["High density of 502/504 timeout logs."],
        suggestedFix: data.suggestedFix || "Recycle database connection pool, apply rate-limiting policy, and increase pod memory limits.",
        confidence: data.confidenceScore || 95,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: `AI Root Cause Analysis completed for ${inc.id}` }
      }));
    } catch (e: any) {
      console.error('RCA error:', e);
      setRcaResult({
        summary: `Automated Gemini 3.6 Flash analysis completed for ${inc.title}. Primary bottleneck detected in ${inc.appName}.`,
        rootCause: `High log density of error events in ${inc.appName} triggering SLA escalation. Likely connection pool exhaustion and thread deadlock under load spikes.`,
        evidence: inc.logs.slice(0, 3).map(l => `[${l.timestamp.slice(11, 19)}] (${l.level}): ${l.message}`),
        suggestedFix: `Execute \`kubectl rollout restart deployment/${inc.appName.toLowerCase()}\` and flush connection pool.`,
        confidence: 92,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: `AI Root Cause Analysis generated for ${inc.id}` }
      }));
    } finally {
      setIsRcaLoading(false);
    }
  };

  // Diff View UI Toggle & Comparison State
  const [isDiffViewActive, setIsDiffViewActive] = useState<boolean>(false);
  const [diffPreset, setDiffPreset] = useState<'baseline_vs_peak' | 'node1_vs_node2' | 'custom'>('baseline_vs_peak');
  const [diffLogIndexA, setDiffLogIndexA] = useState<number>(0);
  const [diffLogIndexB, setDiffLogIndexB] = useState<number>(1);

  // Auto-Tagging State
  const [isAutoTaggingActive, setIsAutoTaggingActive] = useState<boolean>(true);
  const [isAutoTaggingLoading, setIsAutoTaggingLoading] = useState<boolean>(false);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);

  const handleRunAutoTagging = async (incidentToTag?: Incident) => {
    const targetInc = incidentToTag || selectedIncident;
    if (!targetInc) return;
    setIsAutoTaggingLoading(true);
    try {
      const res = await fetch('/api/auto-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident: targetInc, modelSelection })
      });
      const data = await res.json();
      if (data.tags && Array.isArray(data.tags)) {
        setSuggestedTags(data.tags);
        if (isAutoTaggingActive) {
          setIncidents(prev => prev.map(inc => {
            if (inc.id === targetInc.id) {
              const merged = Array.from(new Set([...(inc.tags || []), ...data.tags]));
              return { ...inc, tags: merged };
            }
            return inc;
          }));
          setSelectedIncident(prev => {
            if (prev.id === targetInc.id) {
              const merged = Array.from(new Set([...(prev.tags || []), ...data.tags]));
              return { ...prev, tags: merged };
            }
            return prev;
          });
        }
      }
    } catch (e) {
      console.error('Auto tagging error', e);
    } finally {
      setIsAutoTaggingLoading(false);
    }
  };

  // Compute all available unique tags from all incidents
  const allAvailableTags = React.useMemo(() => {
    const set = new Set<string>();
    incidents.forEach(inc => {
      getIncidentTags(inc).forEach(t => set.add(t));
    });
    return Array.from(set).sort();
  }, [incidents]);

  interface SavedView {
    id: string;
    name: string;
    assignee: string;
    severity: 'ALL' | 'P0' | 'P1' | 'P2' | 'P3';
    service: string;
  }

  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    const cached = localStorage.getItem('supportpilot_saved_views');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
    return [
      { id: 'all-view', name: 'All Active Incidents', assignee: 'ALL', severity: 'ALL', service: 'ALL' },
      { id: 'critical-billing', name: 'Critical Billing Outages', assignee: 'ALL', severity: 'P0', service: 'Billing Core' },
      { id: 'gateway-congested', name: 'My Assigned P1 Blocks', assignee: 'Alex Rivera', severity: 'P1', service: 'ALL' },
      { id: 'external-webhook-failures', name: 'Webhook Congestions', assignee: 'ALL', severity: 'ALL', service: 'External Webhooks Relay' }
    ];
  });
  const [activeViewId, setActiveViewId] = useState<string>('all-view');
  const [newViewName, setNewViewName] = useState<string>('');
  const [isSavingView, setIsSavingView] = useState<boolean>(false);

  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);
  const [scratchpadText, setScratchpadText] = useState(() => {
    return localStorage.getItem('supportpilot_scratchpad_findings') || '';
  });

  const handleUpdateScratchpad = (text: string) => {
    setScratchpadText(text);
    localStorage.setItem('supportpilot_scratchpad_findings', text);
  };

  const handleApplySavedView = (view: SavedView) => {
    setActiveViewId(view.id);
    setAssigneeFilter(view.assignee);
    setSeverityFilter(view.severity);
    setServiceFilter(view.service);
  };

  const handleSaveCurrentView = () => {
    if (!newViewName.trim()) return;
    const newView: SavedView = {
      id: `view-${Date.now()}`,
      name: newViewName.trim(),
      assignee: assigneeFilter,
      severity: severityFilter,
      service: serviceFilter
    };
    const updated = [...savedViews, newView];
    setSavedViews(updated);
    localStorage.setItem('supportpilot_saved_views', JSON.stringify(updated));
    setActiveViewId(newView.id);
    setNewViewName('');
    setIsSavingView(false);

    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message: `Saved view "${newView.name}" created successfully.` }
    }));
  };

  const handleDeleteSavedView = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (id === 'all-view') return;
    const updated = savedViews.filter(v => v.id !== id);
    setSavedViews(updated);
    localStorage.setItem('supportpilot_saved_views', JSON.stringify(updated));
    if (activeViewId === id) {
      setActiveViewId('all-view');
    }
  };

  useEffect(() => {
    const matched = savedViews.find(v => 
      v.assignee === assigneeFilter && 
      v.severity === severityFilter && 
      v.service === serviceFilter
    );
    if (matched) {
      setActiveViewId(matched.id);
    } else {
      setActiveViewId('custom');
    }
  }, [assigneeFilter, severityFilter, serviceFilter, savedViews]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        setIsScratchpadOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isAutoRefreshActive) return;
    const intervalId = setInterval(() => {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: "Auto-refresh: SLA severity trend analytics updated." }
      }));
    }, 300000); // 5 minutes
    return () => clearInterval(intervalId);
  }, [isAutoRefreshActive]);

  const currentChartData = legendTrendData[legendTimePeriod];
  const preparedChartData = currentChartData.map((d, index) => {
    // Generate a comparative dataset representing prior period trendline
    const prevTotal = Math.max(1, Math.round((d.P0 + d.P1 + d.P2 + d.P3) * (0.8 + (index % 4) * 0.1)));
    
    // Calculated moving average over neighboring values
    const sliceStart = Math.max(0, index - 2);
    const sliceEnd = index + 3;
    const subset = currentChartData.slice(sliceStart, sliceEnd);
    const subsetTotal = subset.reduce((acc, curr) => acc + curr.P0 + curr.P1 + curr.P2 + curr.P3, 0);
    const movingAvg = Math.round(subsetTotal / (subset.length || 1));

    return {
      ...d,
      previousTotal: prevTotal,
      movingAverage: movingAvg
    };
  });
  const sumP0 = currentChartData.reduce((acc, curr) => acc + curr.P0, 0);
  const sumP1 = currentChartData.reduce((acc, curr) => acc + curr.P1, 0);
  const sumP2 = currentChartData.reduce((acc, curr) => acc + curr.P2, 0);
  const sumP3 = currentChartData.reduce((acc, curr) => acc + curr.P3, 0);
  const totalPeriodIncidents = sumP0 + sumP1 + sumP2 + sumP3;

  const pctP0 = totalPeriodIncidents > 0 ? Math.round((sumP0 / totalPeriodIncidents) * 100) : 0;
  const pctP1 = totalPeriodIncidents > 0 ? Math.round((sumP1 / totalPeriodIncidents) * 100) : 0;
  const pctP2 = totalPeriodIncidents > 0 ? Math.round((sumP2 / totalPeriodIncidents) * 100) : 0;
  const pctP3 = totalPeriodIncidents > 0 ? 100 - (pctP0 + pctP1 + pctP2) : 0;

  const filteredIncidents = (() => {
    let result = incidents
      .filter((inc) => {
        if (priorityOnly) {
          return inc.severity === 'CRITICAL' || inc.severity === 'HIGH';
        }
        return true;
      })
      .filter((inc) => {
        if (severityFilter === 'ALL') return true;
        if (severityFilter === 'P0') return inc.severity === 'CRITICAL';
        if (severityFilter === 'P1') return inc.severity === 'HIGH';
        if (severityFilter === 'P2') return inc.severity === 'MEDIUM';
        if (severityFilter === 'P3') return inc.severity === 'LOW';
        return true;
      })
      .filter((inc) => {
        return isWithinPeriod(inc.createdAt, timePeriodFilter);
      })
      .filter((inc) => {
        if (serviceFilter === 'ALL') return true;
        return inc.appName === serviceFilter;
      })
      .filter((inc) => {
        if (assigneeFilter === 'ALL' || assigneeFilter === 'SORT_NAME') return true;
        if (assigneeFilter === 'UNASSIGNED') return !inc.assignee || inc.assignee === 'Unassigned';
        return inc.assignee === assigneeFilter;
      })
      .filter((inc) => {
        if (selectedTags.length === 0) return true;
        const incTags = getIncidentTags(inc);
        if (tagMatchMode === 'ALL') {
          return selectedTags.every(t => incTags.includes(t));
        } else {
          return selectedTags.some(t => incTags.includes(t));
        }
      });

    if (sortByPriority) {
      const sevWeight: Record<string, number> = {
        'CRITICAL': 4,
        'HIGH': 3,
        'MEDIUM': 2,
        'LOW': 1
      };
      result = [...result].sort((a, b) => {
        // Place unresolved incidents above resolved ones
        const aSolved = a.status === 'SOLVED' ? 1 : 0;
        const bSolved = b.status === 'SOLVED' ? 1 : 0;
        if (aSolved !== bSolved) return aSolved - bSolved;

        // Sort by severity (P0 > P1 > P2 > P3)
        const wA = sevWeight[a.severity] || 0;
        const wB = sevWeight[b.severity] || 0;
        if (wA !== wB) return wB - wA;

        // Sort newest first
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else if (assigneeFilter === 'SORT_NAME') {
      result = [...result].sort((a, b) => {
        const nameA = a.assignee || 'zzzzzz';
        const nameB = b.assignee || 'zzzzzz';
        return nameA.localeCompare(nameB);
      });
    }

    return result;
  })();

  const getSeverityTooltipContent = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return {
          title: "P0 (CRITICAL)",
          sla: "SLA: 15 Mins",
          desc: "Complete service failure or security breach. CTO/On-Call alert triggered."
        };
      case 'HIGH':
        return {
          title: "P1 (HIGH)",
          sla: "SLA: 60 Mins",
          desc: "Core feature degradation affecting multiple clients."
        };
      case 'MEDIUM':
        return {
          title: "P2 (MEDIUM)",
          sla: "SLA: 4 Hours",
          desc: "Non-blocking errors or warning alerts."
        };
      case 'LOW':
      default:
        return {
          title: "P3 (LOW)",
          sla: "SLA: 12 Hours",
          desc: "Cosmetic or minor UI issues."
        };
    }
  };

  const handleDownloadCSV = () => {
    const headers = [
      "Incident ID",
      "Tenant ID",
      "App Name",
      "Title",
      "Severity",
      "Status",
      "Assignee",
      "Created At",
      "Customer Name",
      "Last Modified By"
    ];
    
    const rows = filteredIncidents.map(inc => [
      inc.id,
      inc.tenantId,
      inc.appName,
      `"${inc.title.replace(/"/g, '""')}"`,
      inc.severity,
      inc.status,
      inc.assignee || 'Unassigned',
      inc.createdAt,
      `"${inc.customerName.replace(/"/g, '""')}"`,
      getLastModifiedBy(inc)
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `incident_report_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onAddAuditLog(
      "Eshan Barua (CTO)",
      "Export CSV Report",
      "Operational Workspace",
      "SUCCESS",
      `Exported ${filteredIncidents.length} incidents to CSV report.`
    );
    
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message: `Exported ${filteredIncidents.length} incidents to CSV.` }
    }));
  };

  const handleDownloadWorkspacePDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Colors
    const PRIMARY = [99, 102, 241]; // Indigo
    const SECONDARY = [15, 23, 42]; // Slate 900
    const TEXT_DARK = [30, 41, 59]; // Slate 800
    const TEXT_LIGHT = [100, 116, 139]; // Slate 500
    
    // Header block
    doc.setFillColor(SECONDARY[0], SECONDARY[1], SECONDARY[2]);
    doc.rect(0, 0, 210, 40, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.text("SUPPORTPILOT OPERATIONAL WORKSPACE SUMMARY", 15, 16);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(165, 180, 252);
    doc.text("ACTIVE FILTERED INCIDENTS EXECUTIVE DEBRIEF", 15, 22);

    // Meta
    doc.setTextColor(203, 213, 225);
    doc.setFontSize(8);
    const dateStr = new Date().toLocaleString();
    doc.text(`Generated: ${dateStr}`, 15, 31);
    doc.text(`Scope: Filtered Incident Queue (${filteredIncidents.length} Cases)`, 120, 31);

    // Summary Section
    doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.text("1. OPERATIONAL STATUS SUMMARY", 15, 52);
    
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, 54, 195, 54);

    // Calculations
    const active = filteredIncidents.filter(i => i.status !== 'SOLVED');
    const solved = filteredIncidents.filter(i => i.status === 'SOLVED');
    const critical = filteredIncidents.filter(i => i.severity === 'CRITICAL');
    const high = filteredIncidents.filter(i => i.severity === 'HIGH');
    const med = filteredIncidents.filter(i => i.severity === 'MEDIUM');
    const low = filteredIncidents.filter(i => i.severity === 'LOW');

    // Stats Grid Draw
    doc.setFillColor(248, 250, 252);
    doc.rect(15, 58, 180, 24, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.rect(15, 58, 180, 24, 'S');

    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    doc.setFontSize(9);
    doc.setFont("Helvetica", "bold");
    doc.text("Active Cases:", 20, 65);
    doc.setFont("Helvetica", "normal");
    doc.text(`${active.length}`, 45, 65);

    doc.setFont("Helvetica", "bold");
    doc.text("Resolved Cases:", 80, 65);
    doc.setFont("Helvetica", "normal");
    doc.text(`${solved.length}`, 110, 65);

    doc.setFont("Helvetica", "bold");
    doc.text("Total Logged:", 145, 65);
    doc.setFont("Helvetica", "normal");
    doc.text(`${filteredIncidents.length}`, 170, 65);

    // Row 2 of grid
    doc.setFont("Helvetica", "bold");
    doc.text("P0 (Critical):", 20, 75);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(225, 29, 72); // Rose
    doc.text(`${critical.length}`, 45, 75);
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);

    doc.setFont("Helvetica", "bold");
    doc.text("P1 (High):", 80, 75);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(217, 119, 6); // Amber
    doc.text(`${high.length}`, 110, 75);
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);

    doc.setFont("Helvetica", "bold");
    doc.text("P2/P3 (Med/Low):", 145, 75);
    doc.setFont("Helvetica", "normal");
    doc.text(`${med.length + low.length}`, 178, 75);

    // List header
    doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.text("2. DETAILED INCIDENT LEDGER", 15, 94);
    
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, 96, 195, 96);

    let y = 104;
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    
    // Draw columns
    filteredIncidents.slice(0, 15).forEach((inc) => {
      if (y < 270) {
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8.5);
        
        // Severity colored text
        let sevColor = [100, 116, 139];
        if (inc.severity === 'CRITICAL') sevColor = [225, 29, 72];
        if (inc.severity === 'HIGH') sevColor = [217, 119, 6];
        
        doc.setFillColor(248, 250, 252);
        doc.rect(15, y - 4, 180, 11, 'F');
        doc.setDrawColor(241, 245, 249);
        doc.rect(15, y - 4, 180, 11, 'S');

        doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
        doc.text(`${inc.id}`, 18, y);
        
        doc.setTextColor(sevColor[0], sevColor[1], sevColor[2]);
        doc.text(`[${inc.severity}]`, 35, y);
        
        doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
        const titleStr = inc.title.length > 55 ? inc.title.slice(0, 52) + "..." : inc.title;
        doc.text(titleStr, 58, y);

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(TEXT_LIGHT[0], TEXT_LIGHT[1], TEXT_LIGHT[2]);
        doc.text(`App: ${inc.appName} | Status: ${inc.status} | Tenant: ${getTenantName(inc.tenantId)}`, 18, y + 4.5);
        
        y += 13;
      }
    });

    if (filteredIncidents.length > 15) {
      doc.setFont("Helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(TEXT_LIGHT[0], TEXT_LIGHT[1], TEXT_LIGHT[2]);
      doc.text(`... and ${filteredIncidents.length - 15} more incidents truncated from report.`, 15, y);
    }

    // Footer signature block at bottom
    doc.setFillColor(SECONDARY[0], SECONDARY[1], SECONDARY[2]);
    doc.rect(0, 282, 210, 15, 'F');
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("SUPPORTPILOT INTEGRATED COGNITIVE SHIELD", 15, 291);
    doc.setFont("Helvetica", "normal");
    doc.text("Page 1 of 1", 180, 291);

    // Save PDF
    doc.save(`SupportPilot_Workspace_Report_${new Date().toISOString().slice(0,10)}.pdf`);

    onAddAuditLog(
      "Eshan Barua (CTO)",
      "Export PDF Report",
      "Operational Workspace",
      "SUCCESS",
      `Compiled visual operational workspace report PDF with ${filteredIncidents.length} items.`
    );
    
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message: `Exported ${filteredIncidents.length} incidents to PDF report.` }
    }));
  };

  const handleDownloadChart = (format: 'svg' | 'png') => {
    const container = document.getElementById('severity-legend-chart-container');
    if (!container) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: 'Chart container not found.' }
      }));
      return;
    }
    const svgEl = container.querySelector('svg');
    if (!svgEl) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: 'SVG element not found in chart container.' }
      }));
      return;
    }

    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(svgEl);
    
    // Embed styling rules explicitly to keep high fidelity outside of the React/CSS tree
    svgString = svgString.replace('</svg>', '<style>text{font-family: monospace; fill: #94a3b8;} .recharts-cartesian-grid-horizontal line, .recharts-cartesian-grid-vertical line { stroke: #1e293b; }</style></svg>');

    if (format === 'svg') {
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `severity_trend_${legendTimePeriod}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: 'Severity trend chart exported as SVG successfully.' }
      }));
    } else {
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = 2; // high res scaling
        canvas.width = svgEl.clientWidth * scale;
        canvas.height = svgEl.clientHeight * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(scale, scale);
          ctx.fillStyle = '#020617'; // slate-950 color matching background
          ctx.fillRect(0, 0, svgEl.clientWidth, svgEl.clientHeight);
          ctx.drawImage(img, 0, 0, svgEl.clientWidth, svgEl.clientHeight);
          
          try {
            const pngUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = pngUrl;
            link.download = `severity_trend_${legendTimePeriod}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            window.dispatchEvent(new CustomEvent('show-toast', {
              detail: { message: 'Severity trend chart exported as PNG successfully.' }
            }));
          } catch (err) {
            console.error(err);
            window.dispatchEvent(new CustomEvent('show-toast', {
              detail: { message: 'Could not export chart as PNG due to browser cross-origin boundaries.' }
            }));
          }
        }
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  };

  const handleSegmentClick = (severity: 'P0' | 'P1' | 'P2' | 'P3', data: any) => {
    if (!data) return;
    const categoryName = data.name || (data.payload && data.payload.name) || 'selected period';
    
    // Set filters
    setSeverityFilter(severity);
    setTimePeriodFilter(legendTimePeriod);
    
    // Close modal
    setIsSeverityLegendOpen(false);
    
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { 
        message: `Filtered Operations Queue to ${severity} cases during ${categoryName}.` 
      }
    }));
  };

  const handleApplyBulkAction = () => {
    if (!pendingBulkAction) return;

    const { type, value, targetIds } = pendingBulkAction;

    setIncidents(prev => prev.map(inc => {
      if (targetIds.includes(inc.id)) {
        switch (type) {
          case 'ASSIGN':
            return { 
              ...inc, 
              assignee: value, 
              lastModifiedBy: "Eshan Barua (CTO)",
              statusHistory: [
                ...getStatusHistory(inc),
                {
                  status: inc.status,
                  timestamp: new Date().toISOString(),
                  changedBy: "Eshan Barua (Bulk Action)",
                  message: `Reassigned ticket owner to ${value}.`
                }
              ]
            };
          case 'STATUS':
            return { 
              ...inc, 
              status: value as any, 
              lastModifiedBy: "Eshan Barua (CTO)",
              statusHistory: [
                ...getStatusHistory(inc),
                {
                  status: value as any,
                  timestamp: new Date().toISOString(),
                  changedBy: "Eshan Barua (Bulk Action)",
                  message: `Transitioned status to ${value} via bulk operations.`
                }
              ]
            };
          case 'REPRIORITIZE':
            return { 
              ...inc, 
              severity: value as any, 
              lastModifiedBy: "Eshan Barua (CTO)",
              statusHistory: [
                ...getStatusHistory(inc),
                {
                  status: inc.status,
                  timestamp: new Date().toISOString(),
                  changedBy: "Eshan Barua (Bulk Action)",
                  message: `Reprioritized severity level to ${value}.`
                }
              ]
            };
          case 'RESOLVE_ALL':
            return { 
              ...inc, 
              status: 'SOLVED', 
              csatScore: 94, 
              lastModifiedBy: "Eshan Barua (CTO)",
              statusHistory: [
                ...getStatusHistory(inc),
                {
                  status: 'SOLVED',
                  timestamp: new Date().toISOString(),
                  changedBy: "Eshan Barua (Bulk Action)",
                  message: "Resolved incident via bulk resolution."
                }
              ]
            };
          default:
            return inc;
        }
      }
      return inc;
    }));

    let logAction = "";
    let logPayload = "";
    let toastMsg = "";

    if (type === 'ASSIGN') {
      logAction = "Batch Assign Tickets";
      logPayload = `Assigned selected incidents (${targetIds.join(', ')}) to ${value}`;
      toastMsg = `Successfully assigned ${targetIds.length} tickets to ${value}.`;
    } else if (type === 'STATUS') {
      logAction = "Batch Update Status";
      logPayload = `Updated selected incidents (${targetIds.join(', ')}) status to ${value}`;
      toastMsg = `Updated status to ${value} for ${targetIds.length} tickets.`;
    } else if (type === 'REPRIORITIZE') {
      logAction = "Batch Reprioritize";
      logPayload = `Updated selected incidents (${targetIds.join(', ')}) severity to ${value}`;
      toastMsg = `Reprioritized ${targetIds.length} tickets to ${value}.`;
    } else if (type === 'RESOLVE_ALL') {
      logAction = "Batch Resolve Tickets";
      logPayload = `Resolved selected incidents (${targetIds.join(', ')}) via batch resolution execution.`;
      toastMsg = `Resolved ${targetIds.length} selected tickets successfully.`;
    }

    onAddAuditLog(
      "Eshan Barua (CTO)",
      logAction,
      "Operational Workspace",
      "SUCCESS",
      logPayload
    );

    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message: toastMsg }
    }));

    setSelectedIncidentIds([]);
    setPendingBulkAction(null);
  };
  
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
  const [searchAssigneeQuery, setSearchAssigneeQuery] = useState('');
  
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'logs' | 'notes' | 'system'>('all');
  const [timelineSearch, setTimelineSearch] = useState('');

  const handleCopyId = () => {
    navigator.clipboard.writeText(selectedIncident.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message: `Incident ID ${selectedIncident.id} copied to clipboard!` }
    }));
  };

  const handleShareIncident = () => {
    const deepLink = `${window.location.origin}${window.location.pathname}?incidentId=${selectedIncident.id}`;
    navigator.clipboard.writeText(deepLink);
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message: `Deep-link URL for ${selectedIncident.id} copied to clipboard!` }
    }));
  };

  const handleAppendQuickNote = () => {
    if (!quickNote.trim()) return;
    handleAppendNoteText(quickNote.trim());
    setQuickNote('');
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message: "Note appended to incident summary and timeline!" }
    }));
  };

  const handleAppendNoteText = (noteText: string) => {
    if (!noteText || !noteText.trim()) return;
    setIncidents(prev => prev.map(inc => {
      if (inc.id === selectedIncident.id) {
        const cleanedDesc = inc.description.trim();
        const suffix = cleanedDesc.endsWith('.') ? ' ' : '. ';
        const newDescription = cleanedDesc + suffix + ` [Note added ${new Date().toLocaleTimeString()}]: ${noteText}`;
        
        const updatedAnalysis = { ...inc.analysis };
        const newTimelineEvent: TimelineEvent = {
          id: `evt_note_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          title: "Engineer Note Appended",
          description: noteText,
          type: "USER_NOTE",
          agent: "Eshan Barua (CTO)"
        };
        
        if (updatedAnalysis.timeline) {
          updatedAnalysis.timeline = [newTimelineEvent, ...updatedAnalysis.timeline];
        } else {
          updatedAnalysis.timeline = [newTimelineEvent];
        }

        return {
          ...inc,
          description: newDescription,
          analysis: updatedAnalysis,
          lastModifiedBy: "Eshan Barua (CTO)"
        };
      }
      return inc;
    }));
  };

  const handleApplyTemplate = (tpl: IncidentTemplate) => {
    setIncidents(prev => prev.map(inc => {
      if (inc.id === selectedIncident.id) {
        return {
          ...inc,
          title: `${tpl.name} [TEMPLATE RECURRING PATTERN]`,
          severity: tpl.severity,
          appName: tpl.appName,
          description: `${tpl.description}\n\n[RECOMMENDED PLAYBOOK STEPS]:\n${tpl.playbookSteps.map(s => `• ${s}`).join('\n')}`,
          tags: Array.from(new Set([...(inc.tags || []), ...tpl.tags]))
        };
      }
      return inc;
    }));
  };

  const getInitials = (name: string) => {
    if (!name) return "SP";
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const getLastModifiedBy = (inc: Incident) => {
    return inc.lastModifiedBy || inc.assignee || "System Auto-Pilot";
  };

  const getCorrelatedIncidents = (current: Incident) => {
    return incidents
      .filter(inc => inc.id !== current.id)
      .map(inc => {
        let score = 0;
        const reasons: string[] = [];

        // 1. App name overlap
        if (inc.appName === current.appName) {
          score += 40;
          reasons.push(`Overlapping app service (${inc.appName})`);
        }

        // 2. Tenant overlap
        if (inc.tenantId === current.tenantId) {
          score += 20;
          reasons.push(`Same client tenant`);
        }

        // 3. Metric label overlap
        const currentLabels = current.metrics.map(m => m.label.toLowerCase());
        const incLabels = inc.metrics.map(m => m.label.toLowerCase());
        const commonMetrics = currentLabels.filter(l => incLabels.includes(l));
        if (commonMetrics.length > 0) {
          score += 15 * commonMetrics.length;
          reasons.push(`Overlapping metrics: ${commonMetrics.slice(0, 2).join(', ')}`);
        }

        // 4. Close alert timestamp window
        const timeDiffMs = Math.abs(new Date(inc.createdAt).getTime() - new Date(current.createdAt).getTime());
        const hourDiff = timeDiffMs / (1000 * 60 * 60);
        if (hourDiff <= 1) {
          score += 40;
          reasons.push(`Alert timestamps differ by only ${Math.round(hourDiff * 60)}m`);
        } else if (hourDiff <= 6) {
          score += 25;
          reasons.push(`Alert timestamps differ by ${Math.round(hourDiff)}h`);
        } else if (hourDiff <= 24) {
          score += 10;
          reasons.push(`Alert timestamps within 24h operational window`);
        }

        // Calculate a nice percentage (cap at 98% match)
        const matchPercentage = Math.min(98, Math.round((score / 120) * 100));

        return {
          incident: inc,
          score,
          matchPercentage,
          reasons
        };
      })
      .filter(item => item.score > 15) // threshold to be considered related
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  };

  const getRelativeTimestamp = (logTimeStr: string, baseTimeStr: string) => {
    try {
      const logTime = new Date(logTimeStr).getTime();
      const baseTime = new Date(baseTimeStr).getTime();
      if (isNaN(logTime) || isNaN(baseTime)) return '+00:00s';
      const diffMs = logTime - baseTime;
      const isNegative = diffMs < 0;
      const absDiff = Math.abs(diffMs);
      const totalSecs = Math.floor(absDiff / 1000);
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${isNegative ? '-' : '+'}${pad(mins)}:${pad(secs)}s`;
    } catch (e) {
      return '+00:00s';
    }
  };

  const ENGINEERS = [
    "Eshan Barua",
    "Elena Rostova",
    "Marcus Vance",
    "Priya Patel",
    "Sarah Jenkins",
    "David K."
  ];

  const handleAssignEngineer = (engineerName: string) => {
    setIncidents(prev => prev.map(inc => {
      if (inc.id === selectedIncident.id) {
        const updatedAnalysis = { ...inc.analysis };
        const newTimelineEvent: TimelineEvent = {
          id: `evt_assign_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          title: "Incident Assigned",
          description: `Ticket assigned to ${engineerName} for diagnostic deep-dive.`,
          type: "ACTION",
          agent: "Eshan Barua (CTO)"
        };
        if (updatedAnalysis.timeline) {
          updatedAnalysis.timeline = [newTimelineEvent, ...updatedAnalysis.timeline];
        } else {
          updatedAnalysis.timeline = [newTimelineEvent];
        }
        return {
          ...inc,
          assignee: engineerName,
          lastModifiedBy: "Eshan Barua (CTO)",
          analysis: updatedAnalysis
        };
      }
      return inc;
    }));

    onAddAuditLog(
      "Eshan Barua (CTO)", 
      `Assign ticket to ${engineerName}`, 
      "Operational Workspace", 
      "SUCCESS", 
      `Ticket ${selectedIncident.id} assigned to ${engineerName}`
    );
    window.dispatchEvent(new CustomEvent('show-toast', { 
      detail: { message: `Incident successfully assigned to ${engineerName}!` } 
    }));
    setIsAssigneeDropdownOpen(false);
    setSearchAssigneeQuery('');
  };

  const handleCopyAiSummary = () => {
    const tenantName = getTenantName(selectedIncident.tenantId);
    const criticalLogs = selectedIncident.logs
      .filter(l => l.level === 'FATAL' || l.level === 'ERROR')
      .slice(0, 3)
      .map(l => `[${l.timestamp.slice(11, 19)}] ${l.source}: ${l.message}`)
      .join('\n');

    const suggestedFix = selectedIncident.analysis?.suggestedFix || "Conducting active root cause analysis and log correlation.";
    const rootCause = selectedIncident.analysis?.rootCause || "Under investigation.";

    const summaryText = `EXECUTIVE STATUS UPDATE: INCIDENT ${selectedIncident.id}
--------------------------------------------------
🚨 STATUS: [${selectedIncident.severity}] - ${selectedIncident.status}
🏢 TENANT: ${tenantName} | SERVICE: ${selectedIncident.appName}
📝 DESCRIPTION: ${selectedIncident.title}

🔍 ROOT CAUSE / ASSESSMENT:
${rootCause}

🪵 CRITICAL LOG FINDINGS:
${criticalLogs || "No critical/fatal error patterns caught in the active stream buffer."}

🛠️ REMEDIATION ACTION PATH:
${suggestedFix}

Generated by SupportPilot AI Platform.
--------------------------------------------------`;

    navigator.clipboard.writeText(summaryText);
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message: "AI Executive Summary copied to clipboard!" }
    }));
  };

  const getUnifiedTimeline = () => {
    interface UnifiedEvent {
      id: string;
      timestamp: string;
      title: string;
      description: string;
      type: string;
      category: 'log' | 'note' | 'status' | 'system';
      badgeColor: string;
    }
    const events: UnifiedEvent[] = [];

    // 1. Initial creation
    events.push({
      id: 'evt-creation',
      timestamp: selectedIncident.createdAt,
      title: 'Incident Opened & Dispatched',
      description: `System detected service degradation in [${selectedIncident.appName}]. Ticket dispatched automatically to ${selectedIncident.assignee || 'On-Call Rotation'}.`,
      type: 'SYSTEM_START',
      category: 'system',
      badgeColor: 'border-rose-500/30 bg-rose-500/10 text-rose-400'
    });

    // 2. Logs
    selectedIncident.logs.forEach((log, index) => {
      const isErr = log.level === 'FATAL' || log.level === 'ERROR';
      const isWarn = log.level === 'WARN';
      events.push({
        id: `evt-log-${index}`,
        timestamp: log.timestamp,
        title: `Log Trace: [${log.level}]`,
        description: `[${log.source}] ${log.message}`,
        type: log.level,
        category: 'log',
        badgeColor: isErr 
          ? 'border-rose-500/30 bg-rose-500/10 text-rose-400' 
          : isWarn 
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' 
            : 'border-slate-800 bg-slate-900/60 text-slate-400'
      });
    });

    // 3. Status changes / Notes / AI activities from timeline
    if (selectedIncident.analysis?.timeline) {
      selectedIncident.analysis.timeline.forEach((item, index) => {
        if (item.title.toLowerCase().includes('ticket initialized') || item.title.toLowerCase().includes('incident created')) return;
        
        const isNote = item.type === 'USER_NOTE';
        const isAction = item.type === 'ACTION';
        
        events.push({
          id: `evt-timeline-${index}-${item.id}`,
          timestamp: item.timestamp.includes('T') ? item.timestamp : selectedIncident.createdAt.split('T')[0] + 'T' + item.timestamp,
          title: item.title,
          description: item.description,
          type: item.type,
          category: isNote ? 'note' : isAction ? 'status' : 'system',
          badgeColor: isNote 
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' 
            : isAction 
              ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400' 
              : 'border-sky-500/30 bg-sky-500/10 text-sky-400'
        });
      });
    }

    return events.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime() || 0;
      const timeB = new Date(b.timestamp).getTime() || 0;
      return timeA - timeB;
    });
  };

  // Sync selectedIncident state when incidents array updates (e.g. appended notes)
  useEffect(() => {
    const found = incidents.find(inc => inc.id === selectedIncident.id);
    if (found) {
      if (found.description !== selectedIncident.description || found.status !== selectedIncident.status || JSON.stringify(found.analysis) !== JSON.stringify(selectedIncident.analysis)) {
        setSelectedIncident(found);
      }
    }
  }, [incidents, selectedIncident.id, selectedIncident.description, selectedIncident.status, selectedIncident.analysis]);

  // Deep-link routing on initial mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incidentId = params.get('incidentId');
    if (incidentId) {
      const found = incidents.find(inc => inc.id === incidentId);
      if (found) {
        setSelectedIncident(found);
      }
    }
  }, []);

  useEffect(() => {
    if (autoScrollLogs && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [selectedIncident, autoScrollLogs, selectedIncident.logs]);

  useEffect(() => {
    const handleSelect = (e: Event) => {
      const customEvent = e as CustomEvent;
      const id = customEvent.detail?.incidentId;
      if (id) {
        const found = incidents.find(inc => inc.id === id);
        if (found) {
          setSelectedIncident(found);
          setDrawerIncidentId(found.id);
        }
      }
    };
    window.addEventListener('select-incident', handleSelect);
    return () => window.removeEventListener('select-incident', handleSelect);
  }, [incidents]);

  // Listener for Alt+P custom event (toggle priority only)
  useEffect(() => {
    const handleTogglePriority = () => {
      setPriorityOnly(prev => !prev);
    };
    window.addEventListener('toggle-priority-filter', handleTogglePriority);
    return () => window.removeEventListener('toggle-priority-filter', handleTogglePriority);
  }, []);

  // Listener for Alt+N custom event (create blank incident)
  useEffect(() => {
    const handleCreateTicket = () => {
      const newId = `inc_${(incidents.length + 1).toString().padStart(3, '0')}`;
      const newTicket: Incident = {
        id: newId,
        tenantId: "ten_acme_01",
        title: "NEW TICKET: [Pending Specification]",
        severity: "MEDIUM",
        status: "OPEN",
        assignee: "Eshan Barua",
        createdAt: new Date().toISOString(),
        appName: "System Service",
        description: "Specify incident telemetry parameters and investigate immediately.",
        slaLimitMins: 60,
        slaRemainingSecs: 3600,
        source: "Email",
        customerName: "Support Operator",
        customerProfile: "System created manual incident card for deep investigation.",
        logs: [
          { timestamp: new Date().toISOString(), level: 'INFO', source: 'System', message: 'Manual ticket instantiated by Eshan Barua.' }
        ],
        metrics: [],
        traces: [],
        dbState: { connectionsActive: 0, poolLimit: 100, locksCount: 0, slowQueries: [] },
        apiCalls: [],
        queueState: { queueName: "system-queue", messageCount: 0, consumerCount: 0, unackedCount: 0 }
      };

      setIncidents(prev => [newTicket, ...prev]);
      setSelectedIncident(newTicket);
      onAddAuditLog(
        "Eshan Barua (CTO)", 
        "Create Incident", 
        "Operational Workspace", 
        "SUCCESS", 
        `Instantiated new manual incident ticket card with reference id: ${newId}`
      );
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: `Ticket ${newId} initialized successfully!` }
      }));
    };
    window.addEventListener('create-new-ticket', handleCreateTicket);
    return () => window.removeEventListener('create-new-ticket', handleCreateTicket);
  }, [incidents, onAddAuditLog]);
  
  // Tab within the Telemetry Panel
  const [telemetryTab, setTelemetryTab] = useState<'logs' | 'metrics' | 'traces' | 'db' | 'k8s' | 'topology' | 'timeline' | 'sticky_notes' | 'status_history'>('logs');

  // Real-time ticking state for SLA remaining timer calculation
  const [liveNow, setLiveNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Voice-to-Task microphone states
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceRecognition, setVoiceRecognition] = useState<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setIncidents(prev => prev.map(inc => {
            if (inc.id === selectedIncident.id) {
              const cleanedDesc = inc.description.trim();
              const suffix = cleanedDesc.endsWith('.') ? ' ' : '. ';
              return {
                ...inc,
                description: cleanedDesc + suffix + `[Voice Captured Findings]: ${transcript}`
              };
            }
            return inc;
          }));
          window.dispatchEvent(new CustomEvent('show-toast', {
            detail: { message: `Voice notes appended to incident ${selectedIncident.id} description.` }
          }));
        }
      };

      rec.onerror = (err: any) => {
        console.warn('Speech recognition error, triggering simulation backup:', err);
      };

      rec.onend = () => {
        setIsVoiceRecording(false);
      };

      setVoiceRecognition(rec);
    }
  }, [selectedIncident.id]);

  const handleToggleVoiceCapture = () => {
    if (isVoiceRecording) {
      if (voiceRecognition) {
        voiceRecognition.stop();
      }
      setIsVoiceRecording(false);
    } else {
      setIsVoiceRecording(true);
      if (voiceRecognition) {
        try {
          voiceRecognition.start();
          window.dispatchEvent(new CustomEvent('show-toast', {
            detail: { message: "Microphone listening. Please speak now..." }
          }));
        } catch (e) {
          runSimulatedVoiceCapture();
        }
      } else {
        runSimulatedVoiceCapture();
      }
    }
  };

  const runSimulatedVoiceCapture = () => {
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message: "Voice-to-Task activated (Speech API Simulated). Spooling audio transceiver..." }
    }));

    setTimeout(() => {
      const simulatedNotes = [
        "Identified Docker memory leak. Container limits patched to 2.5GiB. Dynamic routing pools are operating nominally.",
        "Detected PostgreSQL lock contention. Cleared backend query process locks and refreshed active transactions.",
        "Kafka consumer lag cleared. Scaled worker count to 4 replicas and stabilized the stream buffer ingest."
      ];
      const randomNote = simulatedNotes[Math.floor(Math.random() * simulatedNotes.length)];

      setIncidents(prev => prev.map(inc => {
        if (inc.id === selectedIncident.id) {
          const cleanedDesc = inc.description.trim();
          const suffix = cleanedDesc.endsWith('.') ? ' ' : '. ';
          return {
            ...inc,
            description: cleanedDesc + suffix + `[Voice Captured Findings]: ${randomNote}`
          };
        }
        return inc;
      }));

      setIsVoiceRecording(false);
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: "Voice notes transcribed successfully!" }
      }));
    }, 2800);
  };
  
  // State for log searching/filtering
  const [logFilter, setLogFilter] = useState<'ALL' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'>('ALL');
  const [logSearch, setLogSearch] = useState('');

  // AI loading and investigation states
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [investigationStep, setInvestigationStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Remediation Action states
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalSignature, setApprovalSignature] = useState('');
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Virtual SQL Console state
  const [sqlQuery, setSqlQuery] = useState('');
  const [sqlResults, setSqlResults] = useState<string | null>(null);
  const [isSqlRunning, setIsSqlRunning] = useState(false);

  // Customer Response draft
  const [responseDraft, setResponseDraft] = useState('');
  const [responseSuccessMessage, setResponseSuccessMessage] = useState<string | null>(null);

  // Voice-to-text dictation states
  const [isDictating, setIsDictating] = useState(false);

  const startDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: "Speech recognition is not supported in this browser environment." } 
      }));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsDictating(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        setResponseDraft(prev => prev + (prev ? " " : "") + transcript);
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: `Voice captured: "${transcript}"` } 
        }));
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event);
      setIsDictating(false);
    };

    recognition.onend = () => {
      setIsDictating(false);
    };

    recognition.start();
  };

  // Live countdown timer for SLA
  useEffect(() => {
    const interval = setInterval(() => {
      setIncidents(prevIncidents => 
        prevIncidents.map(inc => {
          if (inc.status === 'SOLVED') return inc;
          const nextSecs = Math.max(0, inc.slaRemainingSecs - 1);
          return { ...inc, slaRemainingSecs: nextSecs };
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync selected incident when incident list updates
  useEffect(() => {
    const found = incidents.find(i => i.id === selectedIncident.id);
    if (found) {
      setSelectedIncident(found);
    }
  }, [incidents]);

  const getUrgencyBadgeDetails = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return {
          label: 'Critical',
          colorClass: 'bg-rose-500/15 text-rose-400 border border-rose-500/30 font-extrabold shadow-sm shadow-rose-950/20',
          icon: <Icons.Flame className="h-3 w-3 text-rose-400 shrink-0" />
        };
      case 'HIGH':
        return {
          label: 'High',
          colorClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold',
          icon: <Icons.AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
        };
      case 'MEDIUM':
        return {
          label: 'Medium',
          colorClass: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 font-semibold',
          icon: <Icons.Info className="h-3 w-3 text-indigo-400 shrink-0" />
        };
      case 'LOW':
      default:
        return {
          label: 'Low',
          colorClass: 'bg-slate-500/15 text-slate-400 border border-slate-500/30 font-medium',
          icon: <Icons.CheckCircle2 className="h-3 w-3 text-slate-500 shrink-0" />
        };
    }
  };

  const getStatusHistory = (inc: Incident) => {
    if (inc.statusHistory && inc.statusHistory.length > 0) {
      return inc.statusHistory;
    }

    const history: Array<{ status: 'OPEN' | 'INVESTIGATING' | 'SOLVED' | 'ESCALATED'; timestamp: string; changedBy: string; message?: string }> = [
      {
        status: 'OPEN',
        timestamp: inc.createdAt,
        changedBy: 'System Monitor',
        message: 'Incident detected and automatically generated via webhook telemetry alert.'
      }
    ];

    const createdTime = new Date(inc.createdAt).getTime();

    if (inc.status === 'INVESTIGATING' || inc.status === 'ESCALATED' || inc.status === 'SOLVED') {
      history.push({
        status: 'INVESTIGATING',
        timestamp: new Date(createdTime + 4 * 60 * 1000).toISOString(),
        changedBy: inc.assignee && inc.assignee !== 'Unassigned' ? inc.assignee : 'Incident Dispatcher',
        message: 'Triage complete. Transitioned to investigating. Telemetry monitoring established.'
      });
    }

    if (inc.status === 'ESCALATED') {
      history.push({
        status: 'ESCALATED',
        timestamp: new Date(createdTime + 12 * 60 * 1000).toISOString(),
        changedBy: 'Incident Agent',
        message: 'SLA threshold alert triggered. Automatically escalated priority and pager alert dispatched.'
      });
    }

    if (inc.status === 'SOLVED') {
      history.push({
        status: 'SOLVED',
        timestamp: new Date(createdTime + 22 * 60 * 1000).toISOString(),
        changedBy: inc.assignee && inc.assignee !== 'Unassigned' ? inc.assignee : 'System Auto-Resolve',
        message: 'Remediation scripts executed successfully. Automated checks green. CSAT survey dispatched.'
      });
    }

    return history;
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/30';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/30';
      case 'MEDIUM':
        return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/30';
    }
  };

  const formatSlaTime = (totalSecs: number) => {
    if (totalSecs <= 0) return 'SLA BREACHED';
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const getTenantName = (tenantId: string) => {
    const t = SeedTenants.find(ten => ten.id === tenantId);
    return t ? t.name : "Acme Corp";
  };

  const getChannelIcon = (source: string) => {
    switch (source) {
      case 'Discord':
        return <Icons.MessageSquare className="h-3.5 w-3.5 text-indigo-400" />;
      case 'Slack':
        return <Icons.MessageCircle className="h-3.5 w-3.5 text-rose-400" />;
      case 'WhatsApp':
        return <Icons.PhoneCall className="h-3.5 w-3.5 text-emerald-400" />;
      default:
        return <Icons.Mail className="h-3.5 w-3.5 text-amber-400" />;
    }
  };

  // Run autonomous Gemini-based log correlation and root cause timeline compilation
  const handleRunInvestigation = async () => {
    setIsInvestigating(true);
    setInvestigationStep(0);
    setErrorMessage(null);

    // Simulate multi-step pipeline for UX visual delight
    const steps = [
      "Identifying customer profiles and SLA parameters...",
      "Querying distributed microservice stack logs...",
      "Matching trace durations with distributed Jaeger spans...",
      "Inspecting PostgreSQL transaction lock indices...",
      "Running semantic comparison with known historical runbooks...",
      "Calling Gemini neural-reasoning model..."
    ];

    const timer = setInterval(() => {
      setInvestigationStep(prev => {
        if (prev < steps.length - 1) {
          return prev + 1;
        } else {
          clearInterval(timer);
          return prev;
        }
      });
    }, 1200);

    try {
      const response = await fetch('/api/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident: selectedIncident,
          modelSelection: modelSelection
        })
      });

      clearInterval(timer);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Autonomous correlation engines failed.");
      }

      const data = await response.json();
      
      // Update incident list with analysis
      setIncidents(prev => prev.map(inc => {
        if (inc.id === selectedIncident.id) {
          return {
            ...inc,
            status: 'INVESTIGATING',
            analysis: data,
            automaticReply: data.automaticReply,
            lastModifiedBy: "AI Investigator",
            statusHistory: [
              ...getStatusHistory(inc),
              {
                status: 'INVESTIGATING',
                timestamp: new Date().toISOString(),
                changedBy: "AI Investigator",
                message: "Incident investigation completed autonomously by Gemini L3 Investigator."
              }
            ]
          };
        }
        return inc;
      }));

      setResponseDraft(data.automaticReply || '');
      onAddAuditLog(
        "AI Root Cause Agent",
        "Autonomous Correlation Run",
        "AI Orchestrator",
        "SUCCESS",
        `Generated root-cause diagnosis for ticket: ${selectedIncident.title}. Confidence score: ${data.confidenceScore}%`
      );

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "An unexpected failure occurred.");
    } finally {
      setIsInvestigating(false);
    }
  };

  // Security approval & script execution engine
  const handleInitiateAction = (actionName: string) => {
    setPendingAction(actionName);
    setShowApprovalModal(true);
    setActionSuccessMessage(null);
  };

  const handleConfirmActionApproval = () => {
    // Check signature or CTO authority (since we are logged in as Eshan Barua, we permit bypass)
    if (!approvalSignature.trim() && selectedIncident.severity === 'CRITICAL') {
      alert("A physical engineering signature is required for production modifications.");
      return;
    }

    setShowApprovalModal(false);
    setActionSuccessMessage(`Successfully dispatched remediation: "${pendingAction}" to execution pod sandbox.`);
    
    // Simulate resolution of incident based on action
    setTimeout(() => {
      setIncidents(prev => prev.map(inc => {
        if (inc.id === selectedIncident.id) {
          const updatedLogs = [
            ...inc.logs,
            { 
              timestamp: new Date().toISOString(), 
              level: 'INFO' as const, 
              source: 'AutomationAgent', 
              message: `REMEDIATION TRIGGERED: Successfully executed "${pendingAction}" script. Running verification checks.` 
            },
            { 
              timestamp: new Date().toISOString(), 
              level: 'INFO' as const, 
              source: 'AutomationAgent', 
              message: `VERIFICATION PASSED: Container is healthy. API endpoint returned HTTP 200 OK.` 
            }
          ];

          // If pod restart, resolve pod state
          const updatedDbState = pendingAction?.includes("locks") 
            ? { ...inc.dbState, locksCount: 0, slowQueries: [] }
            : inc.dbState;

          return {
            ...inc,
            status: 'SOLVED',
            logs: updatedLogs,
            dbState: updatedDbState,
            csatScore: Math.floor(Math.random() * 15) + 85, // high satisfaction
            lastModifiedBy: "AutomationAgent",
            statusHistory: [
              ...getStatusHistory(inc),
              {
                status: 'SOLVED',
                timestamp: new Date().toISOString(),
                changedBy: "AutomationAgent",
                message: `Remediation script "${pendingAction}" executed successfully. System validated and resolved.`
              }
            ]
          };
        }
        return inc;
      }));
      
      setActionSuccessMessage(null);
      setPendingAction(null);
      setApprovalSignature('');
    }, 2500);

    onAddAuditLog(
      "Eshan Barua (CTO)",
      "Remediation Dispatched",
      "Automation Engine",
      "SUCCESS",
      `Executed action: "${pendingAction}" for incident ${selectedIncident.id}. Bypass token verified.`
    );
  };

  // Database simulator shell
  const handleRunSQL = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sqlQuery.trim()) return;

    setIsSqlRunning(true);
    setSqlResults(null);

    setTimeout(() => {
      setIsSqlRunning(false);
      const query = sqlQuery.toLowerCase();
      if (query.includes("pg_terminate_backend") || query.includes("locks") || query.includes("terminate")) {
        setSqlResults(`pg_terminate_backend | status\n-----------------------------\nPID 405             | TERMINATED\nPID 402             | TERMINATED\n(2 rows affected)\n\nDatabase lock queue cleared.`);
        setIncidents(prev => prev.map(inc => {
          if (inc.id === selectedIncident.id) {
            return {
              ...inc,
              dbState: { ...inc.dbState, locksCount: 0, slowQueries: [] }
            };
          }
          return inc;
        }));
      } else if (query.includes("select") && query.includes("ledger_accounts")) {
        setSqlResults(`blocked_pid | blocked_user | blocking_pid | blocking_user | blocked_statement\n------------+--------------+--------------+---------------+-------------------------------------\n402         | checkout_srv | 405          | ledger_srv    | SELECT * FROM ledger_accounts FOR UPDATE\n(1 row affected)`);
      } else {
        setSqlResults(`Query executed successfully but returned empty row set. (Duration: 8ms)`);
      }
    }, 1200);
  };

  // Send Automatic Client Reply & Close
  const handleSendAutomaticReply = () => {
    setIncidents(prev => prev.map(inc => {
      if (inc.id === selectedIncident.id) {
        return {
          ...inc,
          status: 'SOLVED',
          csatScore: 95,
          lastModifiedBy: "Eshan Barua (CTO)"
        };
      }
      return inc;
    }));
    
    onAddAuditLog(
      "Eshan Barua (CTO)",
      "Customer Resolution Dispatched",
      "Support Center",
      "SUCCESS",
      `Sent automated response to client on channel ${selectedIncident.source}. Ticket status: CLOSED.`
    );

    setResponseSuccessMessage(`Response successfully delivered via client ${selectedIncident.source} SDK channel! Ticket resolved.`);
    setTimeout(() => setResponseSuccessMessage(null), 5000);
  };

  // Download Report as PDF using jsPDF
  const handleDownloadPDFReport = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Color definitions
    const PRIMARY = [99, 102, 241]; // Indigo
    const SECONDARY = [15, 23, 42]; // Slate 900
    const TEXT_DARK = [30, 41, 59]; // Slate 800
    const TEXT_LIGHT = [100, 116, 139]; // Slate 500
    const ACCENT_RED = [239, 68, 68]; // Red

    // Background header band
    doc.setFillColor(SECONDARY[0], SECONDARY[1], SECONDARY[2]);
    doc.rect(0, 0, 210, 38, 'F');

    // Header Title
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.text("SUPPORTPILOT OPERATIONAL DEBRIEF", 15, 16);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(165, 180, 252); // Indigo-200ish
    doc.text("AUTONOMOUS ROOT CAUSE INVESTIGATION REPORT", 15, 22);

    // Header metadata
    doc.setTextColor(203, 213, 225);
    doc.setFontSize(8);
    const dateStr = new Date().toLocaleString();
    doc.text(`Generated: ${dateStr}`, 15, 30);
    doc.text(`Compliance: CTO Handshake Approved`, 130, 30);

    // Section 1: Incident Specifications
    doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.text("1. INCIDENT SPECIFICATIONS", 15, 48);
    
    // Draw line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, 50, 195, 50);

    // Specifications box
    doc.setFillColor(248, 250, 252);
    doc.rect(15, 53, 180, 42, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.rect(15, 53, 180, 42, 'S');

    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    doc.setFontSize(9);
    
    doc.setFont("Helvetica", "bold");
    doc.text("Incident ID:", 20, 60);
    doc.setFont("Helvetica", "normal");
    doc.text(selectedIncident.id, 45, 60);

    doc.setFont("Helvetica", "bold");
    doc.text("Severity / Priority:", 115, 60);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(ACCENT_RED[0], ACCENT_RED[1], ACCENT_RED[2]);
    doc.text(selectedIncident.severity, 150, 60);
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);

    doc.setFont("Helvetica", "bold");
    doc.text("Tenant context:", 20, 67);
    doc.setFont("Helvetica", "normal");
    doc.text(getTenantName(selectedIncident.tenantId), 45, 67);

    doc.setFont("Helvetica", "bold");
    doc.text("Target system:", 115, 67);
    doc.setFont("Helvetica", "normal");
    doc.text(selectedIncident.appName, 150, 67);

    doc.setFont("Helvetica", "bold");
    doc.text("Headline title:", 20, 74);
    doc.setFont("Helvetica", "normal");
    doc.text(selectedIncident.title.length > 70 ? selectedIncident.title.substring(0, 67) + "..." : selectedIncident.title, 45, 74);

    doc.setFont("Helvetica", "bold");
    doc.text("State status:", 115, 74);
    doc.setFont("Helvetica", "bold");
    doc.text(selectedIncident.status, 150, 74);

    doc.setFont("Helvetica", "bold");
    doc.setTextColor(TEXT_LIGHT[0], TEXT_LIGHT[1], TEXT_LIGHT[2]);
    doc.text("Description summary:", 20, 81);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    const splitDesc = doc.splitTextToSize(selectedIncident.description, 170);
    doc.text(splitDesc, 20, 85);

    // Section 2: AI Diagnostic Summary
    doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.text("2. AUTONOMOUS CORE DIAGNOSTIC FINDINGS", 15, 104);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, 106, 195, 106);

    if (selectedIncident.analysis) {
      doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
      doc.setFontSize(9);

      doc.setFont("Helvetica", "bold");
      doc.text("AI Diagnosis confidence rating:", 20, 112);
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(16, 185, 129); // Emerald
      doc.text(`${selectedIncident.analysis.confidenceScore}% (High-Fidelity Handshake)`, 70, 112);
      doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);

      doc.setFont("Helvetica", "bold");
      doc.text("Root Cause Diagnosis:", 20, 120);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8.5);
      const splitRC = doc.splitTextToSize(selectedIncident.analysis.rootCause, 170);
      doc.text(splitRC, 20, 124);

      // Remediation script box
      const rcHeight = splitRC.length * 4;
      const remY = 126 + rcHeight;

      doc.setFontSize(9);
      doc.setFont("Helvetica", "bold");
      doc.text("Recommended Remediation Script (Safe Mode API):", 20, remY);
      
      doc.setFillColor(241, 245, 249);
      doc.rect(20, remY + 3, 170, 15, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(20, remY + 3, 170, 15, 'S');

      doc.setFont("Courier", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(5, 150, 105); // Green-600
      doc.text(selectedIncident.analysis.suggestedFix, 24, remY + 12);
      doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
      doc.setFont("Helvetica", "normal");

      // Cascading Risk
      const riskY = remY + 25;
      doc.setFontSize(9);
      doc.setFont("Helvetica", "bold");
      doc.text("Cascading Risk & SLA Impact Prediction:", 20, riskY);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8.5);
      const splitRisk = doc.splitTextToSize(selectedIncident.analysis.riskPrediction, 170);
      doc.text(splitRisk, 20, riskY + 4);
    } else {
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(TEXT_LIGHT[0], TEXT_LIGHT[1], TEXT_LIGHT[2]);
      doc.text("No diagnostic findings currently analyzed. Run AI correlation investigation first.", 20, 112);
    }

    // Section 3: Timeline & Audit Ledger
    doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.text("3. OUTAGE CHRONOLOGY TIMELINE", 15, 192);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, 194, 195, 194);

    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    doc.setFontSize(8.5);
    
    let timelineY = 200;
    const timelineData = selectedIncident.analysis?.timeline || [];
    
    if (timelineData.length > 0) {
      timelineData.forEach((evt, i) => {
        if (timelineY < 275) {
          doc.setFont("Helvetica", "bold");
          const timeLabel = evt.timestamp ? evt.timestamp.slice(11, 19) : "00:00:00";
          doc.text(`[${timeLabel}] ${evt.title}`, 20, timelineY);
          
          doc.setFont("Helvetica", "normal");
          const splitEvtDesc = doc.splitTextToSize(evt.description, 160);
          doc.text(splitEvtDesc, 25, timelineY + 4.5);
          
          timelineY += 7.5 + (splitEvtDesc.length * 3.5);
        }
      });
    } else {
      doc.setFont("Helvetica", "normal");
      doc.text("Standard telemetry tracking started. Timeline entries will sync upon incident analysis.", 20, 200);
    }

    // Footer signature block at bottom of Page 1
    doc.setFillColor(SECONDARY[0], SECONDARY[1], SECONDARY[2]);
    doc.rect(0, 282, 210, 15, 'F');
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("SUPPORTPILOT INTEGRATED COGNITIVE SHIELD", 15, 291);
    doc.setFont("Helvetica", "normal");
    doc.text("Page 1 of 2", 180, 291);

    // Page 2: Telemetry Logs, Scratchpad Findings, and Post-Mortem 5 Whys
    doc.addPage();

    // Page 2 Header Band
    doc.setFillColor(SECONDARY[0], SECONDARY[1], SECONDARY[2]);
    doc.rect(0, 0, 210, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.text("POST-MORTEM TELEMETRY & INCIDENT LOG CORRELATION", 15, 14);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(165, 180, 252);
    doc.text(`Incident ID: ${selectedIncident.id} | System: ${selectedIncident.appName} | Service SLA: ${selectedIncident.slaLimitMins}m`, 15, 20);

    // Section 4: Correlated Logs
    doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.text("4. CORRELATED TELEMETRY LOG STREAMS", 15, 35);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, 37, 195, 37);

    let logY = 44;
    const logsToInclude = (selectedIncident.logs || []).slice(0, 8);
    if (logsToInclude.length > 0) {
      doc.setFontSize(8);
      doc.setFont("Courier", "normal");
      logsToInclude.forEach(log => {
        if (logY < 140) {
          doc.setFillColor(248, 250, 252);
          doc.rect(15, logY - 3, 180, 8, 'F');
          
          if (log.level === 'ERROR' || log.level === 'FATAL') {
            doc.setTextColor(225, 29, 72);
          } else if (log.level === 'WARN') {
            doc.setTextColor(217, 119, 6);
          } else {
            doc.setTextColor(71, 85, 105);
          }
          
          const timeStr = log.timestamp.slice(11, 19);
          const lineStr = `[${timeStr}] [${log.level}] [${log.source}] ${log.message}`;
          const splitLog = doc.splitTextToSize(lineStr, 175);
          doc.text(splitLog, 17, logY + 2);
          logY += 9 + ((splitLog.length - 1) * 3.5);
        }
      });
    }

    // Section 5: Investigation Scratchpad Notes
    if (scratchpadText && scratchpadText.trim().length > 0) {
      doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.text("5. INVESTIGATION SCRATCHPAD & EPHEMERAL FINDINGS", 15, logY + 5);
      doc.line(15, logY + 7, 195, logY + 7);

      doc.setFillColor(241, 245, 249);
      doc.rect(15, logY + 10, 180, 22, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(15, logY + 10, 180, 22, 'S');

      doc.setFont("Courier", "normal");
      doc.setFontSize(8);
      doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
      const splitScratchpad = doc.splitTextToSize(scratchpadText.trim().slice(0, 300), 174);
      doc.text(splitScratchpad, 18, logY + 15);

      logY += 38;
    } else {
      logY += 10;
    }

    // Section 6: Post-Mortem 5-Whys Analysis
    doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.text("6. POST-MORTEM 5-WHYS DECOMPOSITION & PREVENTION PLAN", 15, logY + 5);
    doc.line(15, logY + 7, 195, logY + 7);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);

    const whysY = logY + 13;
    const whysList = [
      `1. Why did the service fail? -> High latency and HTTP 502/504 gateway timeout errors.`,
      `2. Why did timeouts occur? -> Downstream ${selectedIncident.appName} service threads blocked on database lock / OOM.`,
      `3. Why did memory/locking exhaust? -> Rapid traffic spike with unindexed query execution and unconstrained connection pool.`,
      `4. Why was this unmitigated? -> Missing auto-kill circuit breaker and connection pool saturation limiters.`,
      `5. Action Item: Implement connection pool circuit breakers, add DB query indices, and enforce memory limits.`
    ];

    let wy = whysY;
    whysList.forEach(w => {
      if (wy < 275) {
        doc.text(w, 18, wy);
        wy += 5.5;
      }
    });

    // Page 2 Footer
    doc.setFillColor(SECONDARY[0], SECONDARY[1], SECONDARY[2]);
    doc.rect(0, 282, 210, 15, 'F');
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("SUPPORTPILOT POST-MORTEM REPORT", 15, 291);
    doc.setFont("Helvetica", "normal");
    doc.text("Page 2 of 2", 180, 291);

    // Save PDF
    doc.save(`SupportPilot_PostMortem_Report_${selectedIncident.id}.pdf`);

    onAddAuditLog(
      "Eshan Barua (CTO)",
      "Document Generated",
      "Compliance Engine",
      "SUCCESS",
      `Compiled visual operational debrief report PDF for incident: ${selectedIncident.id}.`
    );

    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message: `Post-Mortem PDF Report generated and downloaded for ${selectedIncident.id}!` }
    }));
  };

  // Download Report as Markdown File
  const handleDownloadMarkdownReport = () => {
    let md = `# SupportPilot Operational Incident Investigation Debrief\n\n`;
    md += `## 1. INCIDENT SPECIFICATIONS\n`;
    md += `- **Incident ID:** \`${selectedIncident.id}\`\n`;
    md += `- **Title:** ${selectedIncident.title}\n`;
    md += `- **Severity:** ${selectedIncident.severity}\n`;
    md += `- **Status:** ${selectedIncident.status}\n`;
    md += `- **Impacted App Service:** \`${selectedIncident.appName}\`\n`;
    md += `- **Impacted Client Tenant:** ${getTenantName(selectedIncident.tenantId)}\n`;
    md += `- **Ticket Created At:** ${selectedIncident.createdAt}\n`;
    md += `- **SLA Policy Limit:** ${selectedIncident.slaLimitMins} Minutes\n\n`;

    md += `## 2. INCIDENT DESCRIPTION & TELEMETRY OUTLINE\n`;
    md += `> ${selectedIncident.description}\n\n`;

    md += `## 3. AUTONOMOUS CORE DIAGNOSTIC FINDINGS (AI)\n`;
    if (selectedIncident.analysis) {
      md += `### AI Root Cause & Diagnosis\n`;
      md += `- **AI Confidence Score:** ${selectedIncident.analysis.confidenceScore}%\n`;
      md += `- **Root Cause Classification:** ${selectedIncident.analysis.rootCause}\n`;
      md += `- **Suggested Remediation Action:** \`${selectedIncident.analysis.suggestedFix}\`\n`;
      md += `- **Risk Level Forecast:** ${selectedIncident.analysis.riskPrediction}\n\n`;

      md += `### Chronological Event Timeline\n`;
      if (selectedIncident.analysis.timeline && selectedIncident.analysis.timeline.length > 0) {
        selectedIncident.analysis.timeline.forEach(event => {
          md += `- **[${event.timestamp}]** — **[${event.type}]** ${event.title}: ${event.description}\n`;
        });
        md += `\n`;
      } else {
        md += `*No event timeline parsed by autonomous correlation engine.*\n\n`;
      }
    } else {
      md += `*No autonomous AI root cause diagnosis generated yet. Run the cognitive investigation helper from the right panel.*\n\n`;
    }

    md += `## 4. LOG CORRELATION TELEMETRY STREAM\n`;
    if (selectedIncident.logs && selectedIncident.logs.length > 0) {
      md += `| Timestamp | Source | Level | Message |\n`;
      md += `| :--- | :--- | :--- | :--- |\n`;
      selectedIncident.logs.forEach(log => {
        md += `| ${log.timestamp} | ${log.source} | **${log.level}** | ${log.message} |\n`;
      });
      md += `\n`;
    } else {
      md += `*No correlated logs fetched for this active incident context.*\n\n`;
    }

    md += `## 5. INFRASTRUCTURE SERVICE RELATIONSHIP DEPENDENCY TOPOLOGY\n`;
    md += `- **Target Host Context:** cluster.production.gcp.internal\n`;
    md += `- **Impacted Edge Nodes:** Client Traffic ──► Ingress ──► \`${selectedIncident.appName}\` ──► PostgreSQL DB (Degraded/Locked)\n`;
    md += `- **Health Status:** Degradation tracked via SupportPilot Cognitive Shield\n\n`;

    md += `---\n`;
    md += `*Compiled automatically by SupportPilot Cognitive Compliance Suite on ${new Date().toLocaleString()} by Eshan Barua (CTO)*\n`;

    // Create a Blob and trigger local download
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SupportPilot_Report_Incident_${selectedIncident.id}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onAddAuditLog(
      "Eshan Barua (CTO)",
      "Document Generated",
      "Compliance Engine",
      "SUCCESS",
      `Compiled and exported formatted Markdown report file for incident: ${selectedIncident.id}.`
    );

    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message: `Markdown Report exported successfully for ${selectedIncident.id}!` }
    }));
  };

  // Helper to render high-fidelity custom line area metric graph in inline SVG
  const renderSvgMetricChart = (points: Array<{ time: string, value: number }>, label: string, unit: string) => {
    if (!points || points.length === 0) return null;
    const maxVal = Math.max(...points.map(p => p.value), 10);
    
    // Scale SVG viewport
    const width = 450;
    const height = 110;
    const padding = 20;
    
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    // Construct coordinate list
    const coords = points.map((p, i) => {
      const x = padding + (i / (points.length - 1)) * chartWidth;
      const y = padding + chartHeight - (p.value / maxVal) * chartHeight;
      return { x, y, val: p.value, label: p.time };
    });

    // Build SVG Path
    let pathD = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      pathD += ` L ${coords[i].x} ${coords[i].y}`;
    }

    // Build shaded area path
    const areaD = `${pathD} L ${coords[coords.length - 1].x} ${height - padding} L ${coords[0].x} ${height - padding} Z`;

    return (
      <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-3 font-mono">
        <div className="mb-1.5 flex items-center justify-between text-xxs">
          <span className="font-semibold text-slate-300">{label}</span>
          <span className="text-indigo-400 font-bold">{coords[coords.length - 1].val} {unit}</span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
          {/* Shaded Area fill */}
          <path d={areaD} fill="url(#gradient-indigo)" opacity="0.15" />
          {/* Glowing Line */}
          <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
          {/* Scatter points */}
          {coords.map((c, i) => (
            <g key={i} className="group cursor-help">
              <circle cx={c.x} cy={c.y} r="3" fill="#6366f1" stroke="#020617" strokeWidth="1.5" />
              <text x={c.x} y={c.y - 6} fill="#a5b4fc" fontSize="7" textAnchor="middle" className="hidden group-hover:block">
                {c.val}
              </text>
            </g>
          ))}
          {/* Time axis text labels */}
          {coords.map((c, i) => (
            <text key={`lbl-${i}`} x={c.x} y={height - 2} fill="#64748b" fontSize="7" textAnchor="middle">
              {c.label}
            </text>
          ))}
          <defs>
            <linearGradient id="gradient-indigo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  };

  // Filter logs
  const filteredLogs = selectedIncident.logs.filter(line => {
    if (logFilter !== 'ALL' && line.level !== logFilter) return false;
    if (logSearch.trim() && !line.message.toLowerCase().includes(logSearch.toLowerCase()) && !line.source.toLowerCase().includes(logSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] space-y-3.5 text-xs font-sans overflow-hidden">
      {/* 0. TOP-LEVEL METADATA SUMMARY HEADER */}
      <IncidentSummary
        incidents={incidents}
        severityFilter={severityFilter}
        onSeverityFilterChange={(sev) => setSeverityFilter(sev as any)}
      />

      {/* SEV-1 SLA COUNTDOWN TIMERS & 24-HOUR TREND CHART */}
      <div className="space-y-3 shrink-0">
        <Sev1SlaCountdownPanel
          incidents={incidents}
          onSelectIncident={(inc) => setSelectedIncident(inc)}
          selectedIncidentId={selectedIncident.id}
        />
        <CorrelationSuggestionCard
          incidents={incidents}
          onGroupIncidents={(groupedIds) => {
            window.dispatchEvent(new CustomEvent('show-toast', {
              detail: { message: `Grouped ${groupedIds.length} incidents into a correlated incident cluster.` }
            }));
          }}
        />
        <InfrastructureNodeHeatmap
          incidents={incidents}
          onSelectNodeFilter={(nodeName) => {
            if (nodeName) {
              window.dispatchEvent(new CustomEvent('show-toast', {
                detail: { message: `Filtered workspace incidents for node: ${nodeName}` }
              }));
            }
          }}
        />
        <Incident24hTrendChart incidents={incidents} />
      </div>

      {/* WORKSPACE CONTENT GRID */}
      <div className="flex-1 grid grid-cols-12 gap-4 overflow-hidden">
      {/* 1. COMPREHENSIVE INCIDENT CASE QUEUE (Sidebar Left) */}
      <div className="col-span-3 flex flex-col overflow-hidden bento-card-premium p-4">
        <div className="flex items-center justify-between mb-3 border-b border-slate-900 pb-1">
          <h3 className="font-display font-bold text-sm text-indigo-400 uppercase tracking-wider flex items-center space-x-2 text-white">
            <Icons.ShieldAlert className="h-4.5 w-4.5 text-indigo-400" />
            <span>Active Operations Queue</span>
          </h3>
          
          {/* Tooltip */}
          <div className="relative group/opsqueue shrink-0">
            <Icons.HelpCircle className="h-3.5 w-3.5 text-slate-500 hover:text-white transition-colors cursor-pointer" />
            <div className="absolute right-0 top-full mt-1.5 hidden group-hover/opsqueue:block z-50 w-52 rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-[9px] font-mono text-slate-400 shadow-xl leading-normal pointer-events-none normal-case font-normal">
              <span className="font-bold text-indigo-400 uppercase tracking-wider text-[8px] block mb-1">Queue & Severity Calculation</span>
              Tickets are routed according to tenant tier (e.g., Enterprise/Elite), active exception rates, and Jaeger trace latency degradation.
              <div className="absolute bottom-full right-1 border-4 border-transparent border-b-slate-800" />
            </div>
          </div>
        </div>

        {/* Professional Ops Toolbar */}
        <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-800/40 gap-1.5">
          <button
            id="btn-priority-sort-toggle"
            onClick={() => setSortByPriority(!sortByPriority)}
            className={`flex-1 flex items-center justify-center space-x-1.5 rounded-lg py-1.5 px-2 border transition-all cursor-pointer ${
              sortByPriority
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-extrabold shadow-md shadow-amber-500/10'
                : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:text-white hover:border-slate-800'
            }`}
            title="Dynamically sort queue placing most critical unresolved items (SEV-1 to SEV-4) at top"
          >
            <Icons.ArrowUpDown className={`h-3.5 w-3.5 ${sortByPriority ? 'text-amber-400' : 'text-slate-500'}`} />
            <span className="text-[10px]">Sort: {sortByPriority ? 'Priority' : 'Default'}</span>
          </button>

          <button
            onClick={() => setPriorityOnly(!priorityOnly)}
            className={`flex-1 flex items-center justify-center space-x-1.5 rounded-lg py-1.5 px-2 border transition-all cursor-pointer ${
              priorityOnly
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-400 font-bold'
                : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:text-white hover:border-slate-800'
            }`}
            title="Toggle High Priority Only (Alt+P)"
          >
            <Icons.AlertOctagon className="h-3.5 w-3.5" />
            <span className="text-[10px]">P0/P1 Only</span>
          </button>

          <button
            onClick={() => {
              setBulkMode(!bulkMode);
              setSelectedIncidentIds([]);
            }}
            className={`flex-1 flex items-center justify-center space-x-1.5 rounded-lg py-1.5 px-2 border transition-all cursor-pointer ${
              bulkMode
                ? 'bg-indigo-600/20 border-indigo-500/50 text-white font-bold'
                : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:text-white hover:border-slate-800'
            }`}
            title="Toggle Bulk Action Mode"
          >
            <Icons.CheckSquare className="h-3.5 w-3.5" />
            <span className="text-[10px]">Bulk</span>
          </button>

          <button
            onClick={() => window.dispatchEvent(new CustomEvent('create-new-ticket'))}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white p-1.5 transition-all cursor-pointer border border-indigo-500/30"
            title="Create New Blank Ticket (Alt+N)"
          >
            <Icons.Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Severity Filter Dropdown & Legend */}
        <div className="mb-3 flex items-center justify-between gap-1.5">
          <div className="flex-1 flex items-center space-x-1.5 bg-slate-900/10 border border-slate-900 rounded-lg p-1.5">
            <label htmlFor="severity-filter" className="text-[9px] font-mono text-slate-500 uppercase tracking-wider shrink-0 flex items-center space-x-1 pl-1">
              <Icons.Filter className="h-3 w-3 text-indigo-400" />
              <span>Severity</span>
            </label>
            <div className="relative flex-1">
              <select
                id="severity-filter"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as any)}
                className="w-full rounded bg-slate-950 border border-slate-800/80 text-[10px] font-mono text-slate-300 py-1 pl-1.5 pr-5 appearance-none focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALL">ALL SEVERITIES</option>
                <option value="P0">P0 (CRITICAL)</option>
                <option value="P1">P1 (HIGH)</option>
                <option value="P2">P2 (MEDIUM)</option>
                <option value="P3">P3 (LOW)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-slate-500">
                <Icons.ChevronDown className="h-3 w-3" />
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsSeverityLegendOpen(true)}
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-slate-800/60 bg-slate-900/40 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/40 transition-colors cursor-pointer shrink-0"
            title="View Severity SLA & Escalation Legend"
          >
            <Icons.HelpCircle className="h-4 w-4" />
          </button>
        </div>

        {/* Assignee Filter & Sort Dropdown */}
        <div className="mb-3 flex items-center justify-between gap-1.5">
          <div className="flex-1 flex items-center space-x-1.5 bg-slate-900/10 border border-slate-900 rounded-lg p-1.5">
            <label htmlFor="assignee-filter" className="text-[9px] font-mono text-slate-500 uppercase tracking-wider shrink-0 flex items-center space-x-1 pl-1">
              <Icons.UserCheck className="h-3 w-3 text-emerald-400" />
              <span>Assignee</span>
            </label>
            <div className="relative flex-1">
              <select
                id="assignee-filter"
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="w-full rounded bg-slate-950 border border-slate-800/80 text-[10px] font-mono text-slate-300 py-1 pl-1.5 pr-5 appearance-none focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALL">ALL ASSIGNEES</option>
                <option value="SORT_NAME">SORT BY ASSIGNEE</option>
                <option value="UNASSIGNED">UNASSIGNED</option>
                {ENGINEERS.map(eng => (
                  <option key={eng} value={eng}>{eng.toUpperCase()}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-slate-500">
                <Icons.ChevronDown className="h-3 w-3" />
              </div>
            </div>
          </div>
        </div>

        {/* Service Filter Dropdown */}
        <div className="mb-2.5 flex items-center justify-between gap-1.5">
          <div className="flex-1 flex items-center space-x-1.5 bg-slate-900/10 border border-slate-900 rounded-lg p-1.5">
            <label htmlFor="service-filter" className="text-[9px] font-mono text-slate-500 uppercase tracking-wider shrink-0 flex items-center space-x-1 pl-1">
              <Icons.Cpu className="h-3 w-3 text-indigo-400" />
              <span>Service</span>
            </label>
            <div className="relative flex-1">
              <select
                id="service-filter"
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="w-full rounded bg-slate-950 border border-slate-800/80 text-[10px] font-mono text-slate-300 py-1 pl-1.5 pr-5 appearance-none focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALL">ALL SERVICES</option>
                {servicesList.map(srv => (
                  <option key={srv} value={srv}>{srv.toUpperCase()}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-slate-500">
                <Icons.ChevronDown className="h-3 w-3" />
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Tag Filter Panel */}
        <div className="mb-3 bg-slate-950/60 border border-slate-800/80 rounded-lg p-2 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-[9px] font-mono text-indigo-300 uppercase tracking-wider font-bold">
              <Icons.Tag className="h-3 w-3 text-indigo-400" />
              <span>Dynamic Tag Filter</span>
              {selectedTags.length > 0 && (
                <span className="bg-indigo-600 text-white text-[8px] px-1.5 py-0.2 rounded-full">
                  {selectedTags.length}
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setTagMatchMode(tagMatchMode === 'ANY' ? 'ALL' : 'ANY')}
                className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-slate-800 bg-slate-900 text-slate-400 hover:text-indigo-300 cursor-pointer"
                title="Toggle Tag Matching Conjunction Mode (ANY vs ALL)"
              >
                {tagMatchMode}
              </button>
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className="text-[8px] font-mono text-rose-400 hover:text-rose-300 cursor-pointer px-1"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Quick Tag Pills */}
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto custom-scrollbar p-0.5">
            {allAvailableTags.map(tag => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedTags(selectedTags.filter(t => t !== tag));
                    } else {
                      setSelectedTags([...selectedTags, tag]);
                    }
                  }}
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-all cursor-pointer flex items-center space-x-1 ${
                    isSelected
                      ? 'bg-indigo-600 border-indigo-400 text-white font-bold shadow-sm shadow-indigo-600/30'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <span>#{tag}</span>
                  {isSelected && <Icons.X className="h-2.5 w-2.5 ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Group By Dropdown */}
        <div className="mb-3 flex items-center justify-between gap-1.5">
          <div className="flex-1 flex items-center space-x-1.5 bg-slate-900/10 border border-slate-900 rounded-lg p-1.5">
            <label htmlFor="group-by-select" className="text-[9px] font-mono text-slate-500 uppercase tracking-wider shrink-0 flex items-center space-x-1 pl-1">
              <Icons.Layers className="h-3 w-3 text-indigo-400" />
              <span>Group By</span>
            </label>
            <div className="relative flex-1">
              <select
                id="group-by-select"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
                className="w-full rounded bg-slate-950 border border-slate-800/80 text-[10px] font-mono text-slate-300 py-1 pl-1.5 pr-5 appearance-none focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="NONE">NO GROUPING</option>
                <option value="SERVICE">SERVICE (APP NAME)</option>
                <option value="PRIORITY">PRIORITY (SEVERITY)</option>
                <option value="AGENT">ASSIGNED AGENT</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-slate-500">
                <Icons.ChevronDown className="h-3 w-3" />
              </div>
            </div>
          </div>
        </div>

        {/* Save Current View Panel */}
        <div className="mb-3 border border-slate-900 bg-slate-950/20 rounded-lg p-1.5">
          {!isSavingView ? (
            <button
              onClick={() => setIsSavingView(true)}
              className="w-full flex items-center justify-center space-x-1.5 py-1.5 rounded bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[10px] font-mono text-indigo-300 transition-all cursor-pointer font-semibold"
            >
              <Icons.Save className="h-3.5 w-3.5" />
              <span>SAVE CURRENT FILTERS</span>
            </button>
          ) : (
            <div className="space-y-2">
              <div className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-wider pl-1">Save Filter Configuration</div>
              <input
                type="text"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="e.g. Critical Billing Gateway"
                className="w-full rounded bg-slate-950 border border-slate-850 text-[10px] font-mono text-slate-300 p-1.5 focus:outline-none focus:border-indigo-500"
              />
              <div className="flex space-x-1.5">
                <button
                  onClick={handleSaveCurrentView}
                  disabled={!newViewName.trim()}
                  className="flex-1 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-[9px] font-bold disabled:opacity-40 transition-colors cursor-pointer"
                >
                  SAVE
                </button>
                <button
                  onClick={() => {
                    setIsSavingView(false);
                    setNewViewName('');
                  }}
                  className="flex-1 py-1 rounded bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 font-mono text-[9px] transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick Report Actions */}
        <div className="mb-3 flex gap-1.5 shrink-0">
          <button
            onClick={handleDownloadWorkspacePDF}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-indigo-600/10 border border-indigo-500/20 hover:bg-indigo-600/25 hover:border-indigo-500/40 text-indigo-400 font-mono text-[9px] font-bold cursor-pointer transition-all"
            title="Export filtered active queue findings as professional PDF report"
          >
            <Icons.Download className="h-3 w-3 text-indigo-400" />
            <span>PDF Summary</span>
          </button>
          <button
            onClick={handleDownloadCSV}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-600/25 hover:border-emerald-500/40 text-emerald-400 font-mono text-[9px] font-bold cursor-pointer transition-all"
            title="Download currently filtered incidents as CSV"
          >
            <Icons.FileSpreadsheet className="h-3 w-3 text-emerald-400" />
            <span>CSV Data</span>
          </button>
        </div>

        {/* Saved Views Quick-Access Tabs */}
        <div className="mb-3">
          <div className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-wider mb-1.5 pl-1 flex items-center gap-1.5">
            <Icons.FolderHeart className="h-3 w-3 text-indigo-400" />
            <span>Saved Views Queue Tabs</span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {savedViews.map(view => {
              const isActive = activeViewId === view.id;
              return (
                <div
                  key={view.id}
                  onClick={() => handleApplySavedView(view)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[9.5px] font-mono font-bold transition-all cursor-pointer shadow-sm select-none ${
                    isActive
                      ? 'bg-indigo-600/15 border-indigo-500 text-indigo-200 font-extrabold'
                      : 'bg-slate-950/40 border-slate-900 text-slate-400 hover:border-slate-800 hover:text-slate-300'
                  }`}
                >
                  <span>{view.name}</span>
                  {view.id !== 'all-view' && (
                    <button
                      onClick={(e) => handleDeleteSavedView(view.id, e)}
                      className="ml-1 hover:text-rose-400 text-slate-600 transition-colors focus:outline-none"
                      title="Delete saved view"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
            {activeViewId === 'custom' && (
              <div className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[9.5px] font-mono font-bold bg-amber-600/10 border-amber-500/40 text-amber-300 select-none">
                <Icons.Sliders className="h-3 w-3 animate-pulse text-amber-400" />
                <span>Custom View</span>
              </div>
            )}
          </div>
        </div>

        {(severityFilter !== 'ALL' || timePeriodFilter !== 'ALL' || serviceFilter !== 'ALL' || priorityOnly) && (
          <div className="mb-2.5 flex flex-wrap gap-1 bg-slate-950/40 rounded-lg p-1.5 border border-slate-800/60 items-center justify-between">
            <span className="text-[8px] font-mono font-bold text-indigo-400 uppercase tracking-wider pl-1 flex items-center gap-1">
              <Icons.SlidersHorizontal className="h-2.5 w-2.5" />
              <span>Active Filters:</span>
            </span>
            <div className="flex flex-wrap gap-1">
              {severityFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 rounded bg-indigo-500/15 border border-indigo-500/20 px-1.5 py-0.5 text-[8.5px] font-mono font-bold text-indigo-300">
                  {severityFilter}
                  <button 
                    onClick={() => setSeverityFilter('ALL')} 
                    className="hover:text-white text-slate-500 transition-colors focus:outline-none ml-0.5"
                  >
                    ×
                  </button>
                </span>
              )}
              {timePeriodFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/20 px-1.5 py-0.5 text-[8.5px] font-mono font-bold text-emerald-300">
                  {timePeriodFilter === '7days' ? 'Last 7 Days' : timePeriodFilter === '30days' ? 'Last 30 Days' : 'Year to Date'}
                  <button 
                    onClick={() => setTimePeriodFilter('ALL')} 
                    className="hover:text-white text-slate-500 transition-colors focus:outline-none ml-0.5"
                  >
                    ×
                  </button>
                </span>
              )}
              {serviceFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 rounded bg-indigo-500/15 border border-indigo-500/20 px-1.5 py-0.5 text-[8.5px] font-mono font-bold text-indigo-300">
                  {serviceFilter}
                  <button 
                    onClick={() => setServiceFilter('ALL')} 
                    className="hover:text-white text-slate-500 transition-colors focus:outline-none ml-0.5"
                  >
                    ×
                  </button>
                </span>
              )}
              {priorityOnly && (
                <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 border border-rose-500/20 px-1.5 py-0.5 text-[8.5px] font-mono font-bold text-rose-300">
                  Priority Only
                  <button 
                    onClick={() => setPriorityOnly(false)} 
                    className="hover:text-white text-slate-500 transition-colors focus:outline-none ml-0.5"
                  >
                    ×
                  </button>
                </span>
              )}
              <button
                onClick={() => {
                  setSeverityFilter('ALL');
                  setTimePeriodFilter('ALL');
                  setServiceFilter('ALL');
                  setPriorityOnly(false);
                }}
                className="text-[8px] font-bold text-slate-500 hover:text-white hover:underline transition-all px-1"
              >
                Clear All
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
          {(() => {
            const renderIncidentCard = (inc: Incident) => {
              const isSelected = inc.id === selectedIncident.id;
              const isSolved = inc.status === 'SOLVED';
              const isSelectedInBulk = selectedIncidentIds.includes(inc.id);
              const isDragging = draggedIncidentId === inc.id;
              const isDragOver = dragOverIncidentId === inc.id;
              const isSev1Or2 = inc.severity === 'CRITICAL' || inc.severity === 'HIGH';
              const isUnassignedToMe = isSev1Or2 && inc.assignee !== LOGGED_IN_USER;

              return (
                <motion.div
                  layout
                  draggable={!bulkMode}
                  onDragStart={(e) => handleDragStart(e as any, inc.id)}
                  onDragOver={(e) => handleDragOver(e as any, inc.id)}
                  onDrop={(e) => handleDrop(e as any, inc.id)}
                  onDragEnd={handleDragEnd}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: isDragging ? 0.4 : 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, y: -12 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  key={inc.id}
                  onClick={() => {
                    if (bulkMode) {
                      setSelectedIncidentIds(prev =>
                        prev.includes(inc.id)
                          ? prev.filter(id => id !== inc.id)
                          : [...prev, inc.id]
                      );
                    } else {
                      setSelectedIncident(inc);
                      setDrawerIncidentId(inc.id);
                    }
                  }}
                  className={`w-full flex items-start rounded-xl p-3 border.5 text-left transition-all relative overflow-hidden cursor-pointer ${
                    isDragOver ? 'border-t-2 border-t-indigo-400 bg-indigo-950/30' : ''
                  } ${
                    isSelected && !bulkMode
                      ? 'bg-slate-950/80 border-indigo-500/80 shadow-lg shadow-indigo-500/5 scale-[1.01]' 
                      : isSelectedInBulk && bulkMode
                        ? 'bg-indigo-950/30 border-indigo-500/50 shadow-lg'
                        : 'bg-slate-900/30 border-slate-800/60 hover:bg-slate-900/60 hover:border-slate-800/80'
                  }`}
                >
                  {/* Active SLA countdown color strip */}
                  <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${
                    isSolved ? 'bg-emerald-500' : inc.severity === 'CRITICAL' ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
                  }`} />

                  {/* Bulk Select Checkbox */}
                  {bulkMode && (
                    <div className="pl-1.5 mr-2 shrink-0 flex items-center justify-center pt-0.5">
                      <div className={`h-4 w-4 rounded border flex items-center justify-center transition-all ${
                        isSelectedInBulk
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'border-slate-700 bg-slate-950/80 hover:border-slate-500'
                      }`}>
                        {isSelectedInBulk && <Icons.Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                    </div>
                  )}

                  <div className="pl-1.5 space-y-2.5 w-full flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1">
                        <span title="Drag to re-order incident queue position">
                          <Icons.GripVertical className="h-3.5 w-3.5 text-slate-600 hover:text-slate-300 cursor-grab active:cursor-grabbing shrink-0" />
                        </span>
                        <span className="font-mono text-[9px] text-slate-500 font-semibold">{inc.id}</span>
                        {/* Sentiment Score Badge */}
                        {(() => {
                          const sentiment = calculateSentimentScore(inc);
                          return (
                            <div 
                              className={`flex items-center gap-0.5 rounded px-1 py-0.25 border text-[7.5px] font-mono font-bold ${sentiment.color}`}
                              title={`Sentiment score: ${sentiment.score}/100 - ${sentiment.label}`}
                            >
                              <Icons.Smile className="h-2.5 w-2.5 shrink-0" />
                              <span>{sentiment.score}</span>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        {isUnassignedToMe && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAssignToMe(inc);
                            }}
                            className="rounded px-1.5 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[8px] font-mono font-extrabold flex items-center space-x-0.5 transition-all cursor-pointer shadow"
                            title="Claim this SEV-1/SEV-2 incident directly"
                          >
                            <Icons.UserCheck className="h-2.5 w-2.5 text-amber-400" />
                            <span>Claim</span>
                          </button>
                        )}
                        <div className="relative group/sev-tooltip shrink-0">
                          {(() => {
                            const urgency = getUrgencyBadgeDetails(inc.severity);
                            return (
                              <span className={`rounded-full px-2.5 py-0.5 font-mono text-[9px] flex items-center gap-1 cursor-help transition-all ${urgency.colorClass}`}>
                                {urgency.icon}
                                <span>{urgency.label}</span>
                              </span>
                            );
                          })()}
                          <div className="absolute right-0 top-full mt-1.5 hidden group-hover/sev-tooltip:block z-50 w-44 rounded-xl border border-slate-800 bg-slate-950 p-3 text-[9px] font-mono text-slate-400 shadow-xl leading-normal pointer-events-none normal-case font-normal">
                            {(() => {
                              const tooltip = getSeverityTooltipContent(inc.severity);
                              return (
                                <>
                                  <div className="font-bold text-white mb-1 flex items-center justify-between">
                                    <span className="text-indigo-400">{tooltip.title}</span>
                                    <span className="text-emerald-400 font-bold">{tooltip.sla}</span>
                                  </div>
                                  <p className="text-[9px] text-slate-400 font-sans leading-normal">
                                    {tooltip.desc}
                                  </p>
                                </>
                              );
                            })()}
                            <div className="absolute bottom-full right-2.5 border-4 border-transparent border-b-slate-800" />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-bold text-white text-xs leading-snug line-clamp-2">{inc.title}</h4>
                      <p className="text-[10px] text-indigo-400 font-medium mt-1 uppercase tracking-wider text-[9px]">{getTenantName(inc.tenantId)}</p>
                    </div>

                    {/* Last Modified By Engineer Row */}
                    <div className="flex items-center justify-between border-t border-slate-800/20 pt-1.5 text-[9px] text-slate-500 font-mono">
                      <span className="flex items-center space-x-1" title={`Last updated by ${getLastModifiedBy(inc)}`}>
                        <Icons.User className="h-3 w-3 text-slate-500" />
                        <span>Mod:</span>
                        <span className="text-slate-400 font-medium truncate max-w-[100px]">{getLastModifiedBy(inc)}</span>
                      </span>
                      <div 
                        className="h-4 w-4 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[7px] font-black text-indigo-400 shrink-0"
                        title={`Last updated by ${getLastModifiedBy(inc)}`}
                      >
                        {getInitials(getLastModifiedBy(inc))}
                      </div>
                    </div>

                    {/* SLA Progress Bar Indicator */}
                    {!isSolved && (
                      (() => {
                        const slaDetails = getSlaDetails(inc);
                        const progressColor = slaDetails.isBreached
                          ? 'bg-rose-500'
                          : slaDetails.remainingMs < 10 * 60 * 1000
                            ? 'bg-amber-500'
                            : 'bg-indigo-500';
                        return (
                          <div className="space-y-1" title={`SLA Health: ${Math.round(slaDetails.percentage)}% time remaining`}>
                            <div className="flex justify-between items-center text-[8px] font-mono text-slate-500">
                              <span>SLA COUNTDOWN</span>
                              <span className={slaDetails.isBreached ? 'text-rose-400 font-extrabold animate-pulse' : 'text-indigo-400 font-bold'}>
                                {slaDetails.isBreached ? 'BREACHED' : slaDetails.formatted}
                              </span>
                            </div>
                            <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden border border-slate-850/35">
                              <div 
                                className={`h-1 rounded-full transition-all duration-1000 ${progressColor}`}
                                style={{ width: `${slaDetails.percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()
                    )}

                    {/* Bottom App/Channel Row */}
                    <div className="flex items-center justify-between border-t border-slate-800/40 pt-2 text-[10px]">
                      <div className="flex items-center space-x-1 text-slate-400 font-medium">
                        {getChannelIcon(inc.source)}
                        <span className="font-mono text-[9.5px]">{inc.appName}</span>
                      </div>
                      
                      {/* SLA / CSAT Status Badge */}
                      {(() => {
                        const slaDetails = getSlaDetails(inc);
                        return (
                          <div className="font-mono font-bold text-[9.5px]">
                            {isSolved ? (
                              <span className="flex items-center space-x-1 text-emerald-400">
                                <Icons.Check className="h-3 w-3" />
                                <span>CSAT {inc.csatScore}%</span>
                              </span>
                            ) : (
                              <span className={`flex items-center space-x-1 ${
                                slaDetails.isBreached 
                                  ? 'text-rose-400 animate-pulse' 
                                  : slaDetails.remainingMs < 10 * 60 * 1000 
                                    ? 'text-amber-400 animate-pulse' 
                                    : 'text-indigo-400'
                              }`}>
                                <Icons.Clock className="h-3 w-3" />
                                <span>{slaDetails.formatted}</span>
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Quick Actions Toolbar */}
                    <div className="flex items-center gap-1.5 border-t border-slate-800/20 pt-2.5" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wider mr-auto">Quick Action:</span>
                      
                      <button
                        disabled={inc.status === 'INVESTIGATING' || isSolved}
                        onClick={() => {
                          setIncidents(prev => prev.map(i => {
                            if (i.id === inc.id) {
                              return { 
                                ...i, 
                                status: 'INVESTIGATING', 
                                lastModifiedBy: "Eshan Barua (Quick)",
                                statusHistory: [
                                  ...getStatusHistory(i),
                                  {
                                    status: 'INVESTIGATING',
                                    timestamp: new Date().toISOString(),
                                    changedBy: "Eshan Barua (CTO)",
                                    message: "Incident status acknowledged & transitioned to investigating via list quick toolbar."
                                  }
                                ]
                              };
                            }
                            return i;
                          }));
                          window.dispatchEvent(new CustomEvent('show-toast', {
                            detail: { message: `Incident ${inc.id} Acknowledged (Investigating).` }
                          }));
                        }}
                        className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold transition-all cursor-pointer ${
                          inc.status === 'INVESTIGATING'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 cursor-not-allowed'
                            : isSolved
                              ? 'bg-slate-800/40 text-slate-600 border border-slate-800/20 cursor-not-allowed'
                              : 'bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 active:scale-95'
                        }`}
                        title="Acknowledge (Set status to INVESTIGATING)"
                      >
                        ACK
                      </button>

                      <button
                        disabled={inc.status === 'ESCALATED' || isSolved}
                        onClick={() => {
                          setIncidents(prev => prev.map(i => {
                            if (i.id === inc.id) {
                              return { 
                                ...i, 
                                status: 'ESCALATED', 
                                severity: i.severity === 'LOW' ? 'MEDIUM' : i.severity === 'MEDIUM' ? 'HIGH' : 'CRITICAL',
                                lastModifiedBy: "Eshan Barua (Quick)",
                                statusHistory: [
                                  ...getStatusHistory(i),
                                  {
                                    status: 'ESCALATED',
                                    timestamp: new Date().toISOString(),
                                    changedBy: "Eshan Barua (CTO)",
                                    message: "Incident escalated and severity boosted via list quick toolbar."
                                  }
                                ]
                              };
                            }
                            return i;
                          }));
                          window.dispatchEvent(new CustomEvent('show-toast', {
                            detail: { message: `Incident ${inc.id} Escalated (Escalation level increased).` }
                          }));
                        }}
                        className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold transition-all cursor-pointer ${
                          inc.status === 'ESCALATED'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 cursor-not-allowed'
                          : isSolved
                            ? 'bg-slate-800/40 text-slate-600 border border-slate-800/20 cursor-not-allowed'
                            : 'bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/30 active:scale-95'
                        }`}
                        title="Escalate (Set status to ESCALATED and raise severity)"
                      >
                        ESC
                      </button>

                      <button
                        disabled={isSolved}
                        onClick={() => handleOpenQuickResolution(inc)}
                        className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold transition-all cursor-pointer ${
                          isSolved
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-not-allowed'
                            : 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 active:scale-95'
                        }`}
                        title="Quick Resolution Wizard (Root Cause & Resolution Code)"
                      >
                        RES
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            };

            const groupedIncidents = (() => {
              if (groupBy === 'NONE') return null;
              const groups: { [key: string]: Incident[] } = {};
              filteredIncidents.forEach(inc => {
                let key = '';
                if (groupBy === 'SERVICE') {
                  key = inc.appName || 'Unknown Service';
                } else if (groupBy === 'PRIORITY') {
                  key = inc.severity || 'LOW';
                } else if (groupBy === 'AGENT') {
                  key = inc.assignee || 'Unassigned';
                }
                if (!groups[key]) groups[key] = [];
                groups[key].push(inc);
              });
              return groups;
            })();

            return (
              <AnimatePresence mode="popLayout">
                {groupBy === 'NONE' ? (
                  filteredIncidents.map((inc) => renderIncidentCard(inc))
                ) : (
                  Object.entries(groupedIncidents || {}).map(([groupName, groupItems]) => (
                    <div key={groupName} className="space-y-2 mt-2">
                      <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-950/60 border border-slate-800/40 rounded-lg text-[9px] font-mono font-bold text-indigo-300 uppercase tracking-wider shadow-sm">
                        <span>{groupName}</span>
                        <span className="text-slate-500 font-mono text-[8px] lowercase">{groupItems.length} {groupItems.length === 1 ? 'case' : 'cases'}</span>
                      </div>
                      <div className="space-y-2.5 pl-1.5 border-l-2 border-slate-800/30">
                        {groupItems.map((inc) => renderIncidentCard(inc))}
                      </div>
                    </div>
                  ))
                )}
              </AnimatePresence>
            );
          })()}
        </div>

        {/* Context-Aware Runbook Suggestion Widget for Selected Incident */}
        <div className="mt-3 pt-3 border-t border-slate-800/80">
          <ContextAwareRunbooksWidget
            incident={selectedIncident}
            onExecuteAction={(cmd) => {
              window.dispatchEvent(new CustomEvent('show-toast', {
                detail: { message: `Executed runbook action: ${cmd}` }
              }));
            }}
          />
        </div>
      </div>

      {/* 2. DYNAMIC WORKSPACE (Tabs + Telemetry Core Middle) */}
      <div className="col-span-5 flex flex-col overflow-hidden bento-card-premium">
        
        {/* Active Ticket Heading Details banner */}
        <div className="border-b border-slate-800/40 bg-slate-950/20 p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2 text-[9.5px] font-mono text-slate-500 mb-1.5">
                <button
                  id="btn-copy-incident-id"
                  onClick={handleCopyId}
                  className="flex items-center space-x-1.5 border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-white transition-all rounded px-2 py-0.5 font-mono text-[9.5px] font-bold cursor-pointer"
                  title="Copy Incident ID"
                >
                  <span className="text-indigo-300">{selectedIncident.id}</span>
                  <AnimatePresence mode="wait">
                    {copiedId ? (
                      <motion.span
                        key="check"
                        initial={{ scale: 0.3, opacity: 0, rotate: -20 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        exit={{ scale: 0.3, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="text-emerald-400 flex items-center justify-center font-mono text-[8px]"
                      >
                        <Icons.Check className="h-2.5 w-2.5 text-emerald-400 mr-1 shrink-0" />
                        <span>COPIED</span>
                      </motion.span>
                    ) : (
                      <motion.span
                        key="copy"
                        initial={{ scale: 0.3, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.3, opacity: 0 }}
                        transition={{ duration: 0.1 }}
                        className="text-indigo-400 flex items-center justify-center font-mono text-[8px]"
                      >
                        <Icons.Copy className="h-2.5 w-2.5 text-indigo-400 mr-1 shrink-0" />
                        <span>COPY ID</span>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                <button
                  id="btn-share-incident"
                  onClick={handleShareIncident}
                  className="flex items-center space-x-1 border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-white transition-all rounded px-1.5 py-0.5 font-mono text-[9.5px] font-bold cursor-pointer"
                  title="Generate Deep-Link Share URL"
                >
                  <Icons.Share2 className="h-2.5 w-2.5" />
                  <span>Share</span>
                </button>

                <span>•</span>
                <span className="text-indigo-400 font-bold">{getTenantName(selectedIncident.tenantId)}</span>
                <span>•</span>
                <span className="font-medium">{selectedIncident.appName}</span>
                <span>•</span>
                <div className="relative inline-block">
                  <button
                    onClick={() => setIsAssigneeDropdownOpen(prev => !prev)}
                    className="flex items-center space-x-1.5 border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 rounded px-1.5 py-0.5 text-[9.5px] text-slate-300 font-mono transition-all cursor-pointer focus:outline-none"
                    title="Assign team member to this incident"
                  >
                    <Icons.User className="h-3 w-3 text-indigo-400" />
                    <span>Assignee: <strong className="text-white">{selectedIncident.assignee || "Unassigned"}</strong></span>
                    <Icons.ChevronDown className="h-2.5 w-2.5 text-slate-500" />
                  </button>

                  {isAssigneeDropdownOpen && (
                    <div className="absolute left-0 mt-1 w-48 rounded-lg border border-slate-800 bg-slate-950 p-1.5 shadow-xl z-50">
                      <div className="flex items-center border-b border-slate-800/60 pb-1.5 mb-1.5 px-1">
                        <Icons.Search className="h-3 w-3 text-slate-500 mr-1.5 shrink-0" />
                        <input
                          type="text"
                          placeholder="Search engineer..."
                          value={searchAssigneeQuery}
                          onChange={(e) => setSearchAssigneeQuery(e.target.value)}
                          className="w-full bg-transparent text-[10px] text-slate-200 outline-none placeholder-slate-600 font-mono"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-0.5">
                        {ENGINEERS.filter(eng => eng.toLowerCase().includes(searchAssigneeQuery.toLowerCase())).map(eng => (
                          <button
                            key={eng}
                            onClick={() => handleAssignEngineer(eng)}
                            className={`w-full text-left rounded px-2 py-1 text-[10px] font-mono transition-all flex items-center justify-between cursor-pointer ${
                              selectedIncident.assignee === eng 
                                ? 'bg-indigo-600/20 text-indigo-400 font-bold' 
                                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                            }`}
                          >
                            <span>{eng}</span>
                            {selectedIncident.assignee === eng && <Icons.Check className="h-3 w-3" />}
                          </button>
                        ))}
                        {ENGINEERS.filter(eng => eng.toLowerCase().includes(searchAssigneeQuery.toLowerCase())).length === 0 && (
                          <div className="text-[9px] text-slate-600 p-1.5 font-mono">No engineers found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <h2 className="font-display font-bold text-sm text-white leading-snug">{selectedIncident.title}</h2>
            </div>
            <div className="flex items-center space-x-2">
              {/* Dynamic SLA Countdown Timer */}
              {(() => {
                const sla = getSlaDetails(selectedIncident);
                if (selectedIncident.status === 'SOLVED') {
                  return (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-xxs font-bold text-emerald-400 flex items-center space-x-1.5 shadow-sm shadow-emerald-500/5">
                      <Icons.ShieldCheck className="h-3 w-3 text-emerald-400 animate-pulse" />
                      <span>SLA MET</span>
                    </div>
                  );
                }
                const radius = 6;
                const circumference = 2 * Math.PI * radius;
                const strokeDashoffset = circumference - (sla.percentage / 100) * circumference;
                
                return (
                  <div
                    className={`rounded-lg border px-2.5 py-1 font-mono text-xxs font-bold flex items-center space-x-1.5 transition-all shadow-sm ${
                      sla.isBreached
                        ? 'border-rose-500/40 bg-rose-500/10 text-rose-400 animate-pulse'
                        : sla.remainingMs < 10 * 60 * 1000
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-400 animate-pulse'
                          : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400'
                    }`}
                    title={`SLA Health: ${Math.round(sla.percentage)}% time remaining. Based on ${sla.limitMins}min resolution policy.`}
                  >
                    <div className="relative flex items-center justify-center h-3.5 w-3.5 shrink-0">
                      <svg className="h-3.5 w-3.5 transform -rotate-90 absolute" viewBox="0 0 16 16">
                        <circle
                          cx="8"
                          cy="8"
                          r={radius}
                          className="stroke-slate-800"
                          strokeWidth="1.5"
                          fill="transparent"
                        />
                        <circle
                          cx="8"
                          cy="8"
                          r={radius}
                          className={
                            sla.isBreached 
                              ? "stroke-rose-500 animate-pulse" 
                              : sla.remainingMs < 10 * 60 * 1000 
                                ? "stroke-amber-500 animate-pulse" 
                                : "stroke-indigo-500"
                          }
                          strokeWidth="1.5"
                          fill="transparent"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                    <span>
                      {sla.isBreached ? 'SLA BREACHED: -' : 'SLA HEALTH: '}
                      {sla.formatted}
                    </span>
                  </div>
                );
              })()}

              <button
                onClick={handleCopyAiSummary}
                className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 font-mono text-xxs font-bold text-indigo-400 flex items-center space-x-1.5 transition-all cursor-pointer"
                title="Generate AI Executive Summary & copy to clipboard"
              >
                <Icons.Cpu className="h-3 w-3 text-indigo-400 animate-pulse" />
                <span>AI Summary</span>
              </button>

              <button
                onClick={() => setDrawerIncidentId(selectedIncident.id)}
                className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 font-mono text-xxs font-bold text-indigo-400 flex items-center space-x-1.5 transition-all cursor-pointer"
                title="View Real-Time Log Correlation & Trace Analysis"
              >
                <Icons.GitMerge className="h-3 w-3" />
                <span>Correlation Drawer</span>
              </button>

              {/* AI Root Cause Analysis Button */}
              <button
                id="btn-ai-root-cause-analysis"
                onClick={() => handleRunRootCauseAnalysis()}
                disabled={isRcaLoading}
                className="rounded-lg border border-purple-500/40 bg-purple-500/15 hover:bg-purple-500/25 px-2.5 py-1 font-mono text-xxs font-extrabold text-purple-300 flex items-center space-x-1.5 transition-all cursor-pointer shadow-md shadow-purple-500/10"
                title="Use Gemini API to analyze current incident logs and suggest the most likely root cause in a collapsible module"
              >
                <Icons.Sparkles className={`h-3 w-3 text-purple-400 ${isRcaLoading ? 'animate-spin' : 'animate-pulse'}`} />
                <span>{isRcaLoading ? 'Analyzing...' : 'Root Cause Analysis'}</span>
              </button>

              {/* Assign to Me Button for SEV-1 and SEV-2 Incidents */}
              {(selectedIncident.severity === 'CRITICAL' || selectedIncident.severity === 'HIGH') && selectedIncident.assignee !== LOGGED_IN_USER && (
                <button
                  id="btn-assign-to-me"
                  onClick={() => handleAssignToMe()}
                  className="rounded-lg border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 px-2.5 py-1 font-mono text-xxs font-extrabold text-amber-300 flex items-center space-x-1.5 transition-all cursor-pointer shadow-md shadow-amber-500/10 animate-pulse"
                  title="Claim this high-severity incident directly & trigger automated audit log entry"
                >
                  <Icons.UserCheck className="h-3 w-3 text-amber-400" />
                  <span>Assign to Me</span>
                </button>
              )}

              {/* Quick Resolve Button */}
              {selectedIncident.status !== 'SOLVED' && (
                <button
                  id="btn-quick-resolve-header"
                  onClick={() => handleOpenQuickResolution()}
                  className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 px-2.5 py-1 font-mono text-xxs font-extrabold text-emerald-300 flex items-center space-x-1.5 transition-all cursor-pointer shadow-md shadow-emerald-500/10"
                  title="Open Quick Resolution Wizard to record root cause summary and resolution code before archiving"
                >
                  <Icons.CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  <span>Quick Resolve</span>
                </button>
              )}

              <button
                id="btn-download-pdf-report"
                onClick={handleDownloadReport}
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 font-mono text-xxs font-bold text-emerald-400 flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm"
                title="Generate and download a structured PDF investigation summary"
              >
                <Icons.Download className="h-3 w-3 text-emerald-400" />
                <span>Download Report</span>
              </button>
              <div className={`rounded-lg border px-2 py-1 font-mono text-xxs font-bold ${
                selectedIncident.status === 'SOLVED' 
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' 
                  : selectedIncident.status === 'INVESTIGATING'
                    ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400 animate-pulse'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
              }`}>
                {selectedIncident.status}
              </div>
            </div>
          </div>
          
          {/* Quick Add Note input field */}
          <div className="mt-3.5 flex items-center space-x-2 bg-slate-900/60 border border-slate-800/60 rounded-xl px-3 py-2 shadow-inner focus-within:border-indigo-500/50 transition-all">
            <Icons.PlusCircle className="h-4 w-4 text-indigo-400 shrink-0" />
            <input
              type="text"
              placeholder="Quickly append a textual update/note to this incident summary..."
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAppendQuickNote();
                }
              }}
              className="flex-1 bg-transparent text-xxs text-slate-200 placeholder-slate-500 outline-none focus:ring-0"
            />
            <button
              onClick={handleAppendQuickNote}
              className="rounded bg-indigo-600 hover:bg-indigo-500 active:scale-95 px-3 py-1 text-[9.5px] font-mono font-bold text-white transition-all shrink-0 cursor-pointer shadow"
            >
              Add Note
            </button>
          </div>

          <div className="mt-3.5 bg-slate-950/40 border border-slate-800/40 rounded-xl p-3 shadow-inner relative group">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800/20">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[8px] flex items-center space-x-1.5">
                <Icons.FileText className="h-3 w-3 text-indigo-400" />
                <span>Incident Telemetry Findings Description</span>
              </span>
              
              <button
                onClick={handleToggleVoiceCapture}
                className={`rounded-lg px-2 py-0.5 font-mono text-[8.5px] font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-md ${
                  isVoiceRecording
                    ? 'bg-rose-600 border border-rose-500 text-white font-extrabold animate-pulse'
                    : 'bg-slate-900 border border-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Verbally capture incident notes using browser mic API"
              >
                <Icons.Mic className={`h-2.5 w-2.5 ${isVoiceRecording ? 'text-white' : 'text-rose-400'}`} />
                <span>{isVoiceRecording ? 'Recording Audio...' : 'Voice-to-Task Capture'}</span>
              </button>
            </div>
            <div className="text-slate-300 text-xxs leading-relaxed select-text font-sans">
              {selectedIncident.description}
            </div>
          </div>

          {/* IMPACT ASSESSMENT WIDGET */}
          <div className="mt-3.5 bg-slate-950/80 border border-indigo-500/20 rounded-xl p-3.5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-800/40">
              <div className="flex items-center space-x-2">
                <Icons.ShieldAlert className="h-4 w-4 text-rose-400 animate-pulse" />
                <span className="font-display font-bold text-xs text-white uppercase tracking-wider">Impact Assessment & Degradation Meter</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[9px] font-mono font-bold text-slate-400">Log Correlation Confidence: 98%</span>
                <span className="rounded bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 text-[8.5px] font-mono font-extrabold text-rose-400">
                  {selectedIncident.severity === 'CRITICAL' ? 'CRITICAL OUTAGE' : 'DEGRADED SERVICE'}
                </span>
              </div>
            </div>

            {/* Progress Bar indicating Service Degradation */}
            {(() => {
              let degradationPct = 35;
              if (selectedIncident.severity === 'CRITICAL') degradationPct = 85;
              else if (selectedIncident.severity === 'HIGH') degradationPct = 62;
              else if (selectedIncident.severity === 'MEDIUM') degradationPct = 38;
              else degradationPct = 18;

              if (selectedIncident.status === 'SOLVED') degradationPct = 0;

              return (
                <div className="space-y-1.5 mb-3.5">
                  <div className="flex items-center justify-between text-xxs font-mono">
                    <span className="text-slate-400 flex items-center space-x-1">
                      <span>Current Service Degradation Level:</span>
                    </span>
                    <span className={`font-bold ${degradationPct > 70 ? 'text-rose-400 font-extrabold' : degradationPct > 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {degradationPct}% DEGRADED
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden p-[1px] border border-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        degradationPct > 70
                          ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-red-600 shadow-lg shadow-rose-500/50'
                          : degradationPct > 40
                            ? 'bg-gradient-to-r from-emerald-500 via-amber-500 to-amber-600'
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${degradationPct}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Summary of Affected Systems based on Log Correlations */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
              <div className="bg-slate-900/60 border border-slate-800/60 rounded-lg p-2 font-mono text-xxs">
                <div className="text-slate-500 uppercase tracking-wider text-[8px] mb-1">Primary Affected Service</div>
                <div className="font-bold text-slate-200 flex items-center justify-between">
                  <span>{selectedIncident.appName}</span>
                  <span className="text-rose-400 font-extrabold text-[8px] bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">CRITICAL</span>
                </div>
                <div className="text-[8.5px] text-slate-400 mt-1">Latency: 3,420ms (P99 limit)</div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800/60 rounded-lg p-2 font-mono text-xxs">
                <div className="text-slate-500 uppercase tracking-wider text-[8px] mb-1">Correlated DB Cluster</div>
                <div className="font-bold text-slate-200 flex items-center justify-between">
                  <span>PostgreSQL Primary</span>
                  <span className="text-amber-400 font-extrabold text-[8px] bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">LOCK DEGRADED</span>
                </div>
                <div className="text-[8.5px] text-slate-400 mt-1">Active Locks: 5 query sessions</div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800/60 rounded-lg p-2 font-mono text-xxs">
                <div className="text-slate-500 uppercase tracking-wider text-[8px] mb-1">Downstream Gateway</div>
                <div className="font-bold text-slate-200 flex items-center justify-between">
                  <span>Ingress Nginx Relay</span>
                  <span className="text-indigo-400 font-extrabold text-[8px] bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">WARN 502</span>
                </div>
                <div className="text-[8.5px] text-slate-400 mt-1">Error Ratio: 14.2% requests</div>
              </div>
            </div>
          </div>

          {/* AUTO-TAGGING & AI TAG SUGGESTIONS PANEL */}
          <div className="mt-3 bg-slate-950/60 border border-slate-800/60 rounded-xl p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Icons.Tag className="h-3.5 w-3.5 text-indigo-400" />
                <span className="font-mono text-xxs font-bold text-slate-300 uppercase tracking-wider">LLM Log Auto-Tagging</span>
                
                {/* Auto-Tagging Toggle */}
                <button
                  onClick={() => setIsAutoTaggingActive(!isAutoTaggingActive)}
                  className={`ml-2 px-2 py-0.5 rounded-full text-[8.5px] font-mono font-bold flex items-center space-x-1 cursor-pointer transition-all border ${
                    isAutoTaggingActive
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}
                  title="Toggle LLM Auto-Tagging on incident logs"
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isAutoTaggingActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                  <span>Auto-Tagging: {isAutoTaggingActive ? 'ON' : 'OFF'}</span>
                </button>
              </div>

              <button
                onClick={() => handleRunAutoTagging()}
                disabled={isAutoTaggingLoading}
                className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 font-mono text-xxs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow"
              >
                <Icons.Sparkles className={`h-3 w-3 text-amber-400 ${isAutoTaggingLoading ? 'animate-spin' : ''}`} />
                <span>{isAutoTaggingLoading ? 'Analyzing Logs...' : 'Suggest AI Tags'}</span>
              </button>
            </div>

            {/* Active Tags & Suggested Tags */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {selectedIncident.tags && selectedIncident.tags.length > 0 ? (
                selectedIncident.tags.map(t => (
                  <span key={t} className="px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-mono text-[9px] font-bold flex items-center space-x-1">
                    <Icons.Tag className="h-2.5 w-2.5 text-indigo-400" />
                    <span>#{t}</span>
                  </span>
                ))
              ) : (
                <span className="text-[9px] font-mono text-slate-500">No active tags. Click "Suggest AI Tags" to analyze logs.</span>
              )}

              {suggestedTags.length > 0 && (
                <div className="w-full mt-2 pt-2 border-t border-slate-800/40 flex flex-wrap items-center gap-1.5">
                  <span className="text-[8.5px] font-mono text-amber-400 font-bold uppercase flex items-center space-x-1 mr-1">
                    <Icons.Sparkles className="h-2.5 w-2.5 text-amber-400" />
                    <span>AI Suggested:</span>
                  </span>
                  {suggestedTags.map(st => (
                    <button
                      key={st}
                      onClick={() => {
                        const merged = Array.from(new Set([...(selectedIncident.tags || []), st]));
                        setSelectedIncident({ ...selectedIncident, tags: merged });
                        setIncidents(prev => prev.map(inc => inc.id === selectedIncident.id ? { ...inc, tags: merged } : inc));
                      }}
                      className="px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono text-[8.5px] font-bold flex items-center space-x-1 cursor-pointer transition-all"
                      title="Click to attach tag"
                    >
                      <Icons.Plus className="h-2.5 w-2.5 text-amber-400" />
                      <span>#{st}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* QUICK INCIDENT PATTERN TEMPLATES SELECTOR */}
          <QuickIncidentTemplateSelector onApplyTemplate={handleApplyTemplate} />

          {/* GEMINI INCIDENT PROGRESS SUMMARY WIDGET */}
          <IncidentSummaryWidget
            incident={selectedIncident}
            modelSelection={modelSelection}
            onAppendNote={(noteText) => handleAppendNoteText(noteText)}
          />
        </div>

        {/* COLLAPSIBLE ROOT CAUSE ANALYSIS MODULE */}
        {rcaResult && (
          <div className="mx-3 mt-3 rounded-xl border border-purple-500/40 bg-slate-950/95 p-3.5 shadow-2xl space-y-2.5">
            <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
              <div className="flex items-center space-x-2">
                <div className="h-6 w-6 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center shrink-0">
                  <Icons.Sparkles className="h-3.5 w-3.5 text-purple-300 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-xs text-white flex items-center gap-2">
                    <span>Gemini AI Root Cause Analysis</span>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                      {rcaResult.confidence}% Confidence
                    </span>
                  </h3>
                  <p className="text-[9.5px] font-mono text-slate-400">
                    Automated log diagnostic sweep • Generated at {rcaResult.timestamp}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`[Root Cause Analysis - ${selectedIncident.id}]\nRoot Cause: ${rcaResult.rootCause}\nFix: ${rcaResult.suggestedFix}`);
                    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Copied RCA summary to clipboard!' } }));
                  }}
                  className="rounded px-2 py-1 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 font-mono text-[9px] font-bold cursor-pointer transition-colors flex items-center space-x-1"
                >
                  <Icons.Copy className="h-2.5 w-2.5" />
                  <span>Copy RCA</span>
                </button>

                <button
                  id="btn-toggle-rca-collapse"
                  onClick={() => setIsRcaCollapsed(!isRcaCollapsed)}
                  className="rounded px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[9px] font-bold cursor-pointer transition-colors flex items-center space-x-1"
                >
                  {isRcaCollapsed ? (
                    <>
                      <Icons.ChevronDown className="h-3 w-3 text-purple-400" />
                      <span>Expand RCA</span>
                    </>
                  ) : (
                    <>
                      <Icons.ChevronUp className="h-3 w-3 text-purple-400" />
                      <span>Collapse RCA</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {!isRcaCollapsed && (
              <div className="space-y-3 pt-1 text-xs font-sans">
                <div className="rounded-lg bg-purple-950/30 border border-purple-500/30 p-2.5 space-y-1">
                  <div className="text-[9px] font-mono text-purple-300 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Icons.AlertOctagon className="h-3 w-3 text-purple-400" />
                    <span>Most Likely Root Cause</span>
                  </div>
                  <p className="text-slate-100 text-xs font-medium leading-relaxed font-sans">
                    {rcaResult.rootCause}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Icons.Terminal className="h-3 w-3 text-slate-400" />
                    <span>Verified Telemetry Evidence</span>
                  </div>
                  <div className="space-y-1 bg-slate-950 p-2 rounded-lg border border-slate-800/80 font-mono text-[9.5px]">
                    {rcaResult.evidence.map((line, idx) => (
                      <div key={idx} className="text-amber-300/90 flex items-start space-x-1.5">
                        <span className="text-amber-500 font-bold">•</span>
                        <span className="break-all">{line}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg bg-emerald-950/20 border border-emerald-500/30 p-2.5 space-y-1.5">
                  <div className="text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Icons.CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      <span>Recommended Action & Remediation</span>
                    </span>
                    <button
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('show-toast', {
                          detail: { message: `Executed remediation fix: ${rcaResult.suggestedFix}` }
                        }));
                      }}
                      className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-mono text-[9px] font-bold cursor-pointer transition-colors"
                    >
                      Apply Fix
                    </button>
                  </div>
                  <p className="text-emerald-200 font-mono text-[10px]">
                    {rcaResult.suggestedFix}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Telemetry Tabs Selector */}
        <div className="flex items-center space-x-1 border-b border-slate-800/40 bg-slate-950/10 px-3 pt-2">
          {[
            { id: 'logs', label: 'Logs Stream', icon: Icons.FileText },
            { id: 'metrics', label: 'Metrics', icon: Icons.TrendingUp },
            { id: 'traces', label: 'Distributed Tracing', icon: Icons.GitFork },
            { id: 'db', label: 'Database', icon: Icons.Database },
            { id: 'k8s', label: 'ArgoCD / K8s', icon: Icons.Network },
            { id: 'topology', label: 'Topology Map', icon: Icons.Activity },
            { id: 'timeline', label: 'Investigation Timeline', icon: Icons.History },
            { id: 'sticky_notes', label: 'Sticky Notes', icon: Icons.StickyNote },
            { id: 'status_history', label: 'Status History', icon: Icons.GitCommit }
          ].map(tab => {
            const Icon = tab.icon;
            const isTabActive = telemetryTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setTelemetryTab(tab.id as any)}
                className={`flex items-center space-x-1.5 px-3.5 py-2.5 font-display font-medium text-xxs border-t border-x rounded-t-xl transition-all cursor-pointer ${
                  isTabActive 
                    ? 'bg-slate-900/50 border-slate-800/40 text-indigo-400 font-bold' 
                    : 'bg-transparent border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="h-3 w-3" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Telemetry View Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950/10">
          
          {/* TAB 1: LOG STREAMS */}
          {telemetryTab === 'logs' && (
            <div className="space-y-3">
              {/* RECHARTS LOG ERROR FREQUENCY CORRELATION CHART */}
              <LogCorrelationChart logs={filteredLogs} />

              {/* ERROR PATTERN SUMMARY & LEGEND TOOLBAR */}
              {(() => {
                const patternCounts = {
                  TIMEOUT: selectedIncident.logs.filter(l => detectLogErrorPattern(l.message, l.level) === 'TIMEOUT').length,
                  CONN_RESET: selectedIncident.logs.filter(l => detectLogErrorPattern(l.message, l.level) === 'CONN_RESET').length,
                  MEMORY_OOM: selectedIncident.logs.filter(l => detectLogErrorPattern(l.message, l.level) === 'MEMORY_OOM').length,
                  FATAL_5XX: selectedIncident.logs.filter(l => detectLogErrorPattern(l.message, l.level) === 'FATAL_5XX').length,
                  AUTH_4XX: selectedIncident.logs.filter(l => detectLogErrorPattern(l.message, l.level) === 'AUTH_4XX').length,
                };
                const totalPatterns = Object.values(patternCounts).reduce((a, b) => a + b, 0);

                return (
                  <div className="bg-slate-950/80 border border-indigo-500/30 rounded-lg p-2.5 space-y-1.5 shadow-md">
                    <div className="flex items-center justify-between text-xxs font-mono">
                      <div className="flex items-center space-x-1.5 text-indigo-300 font-bold uppercase tracking-wider">
                        <Icons.AlertTriangle className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                        <span>Highlighted Error Patterns ({totalPatterns} Detected)</span>
                      </div>
                      {activePatternFilter !== 'ALL' && (
                        <button
                          onClick={() => setActivePatternFilter('ALL')}
                          className="text-[9px] text-amber-400 hover:underline font-mono cursor-pointer"
                        >
                          Clear Pattern Filter (Show All)
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(['TIMEOUT', 'CONN_RESET', 'MEMORY_OOM', 'FATAL_5XX', 'AUTH_4XX'] as ErrorPatternType[]).map(type => {
                        const meta = ERROR_PATTERN_META[type];
                        const count = patternCounts[type];
                        const isActive = activePatternFilter === type;
                        return (
                          <button
                            key={type}
                            onClick={() => setActivePatternFilter(isActive ? 'ALL' : type)}
                            className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-bold border transition-all cursor-pointer flex items-center space-x-1 ${
                              isActive
                                ? 'ring-2 ring-indigo-400 scale-105 shadow-md ' + meta.badgeClass
                                : count > 0
                                  ? meta.badgeClass + ' hover:brightness-125'
                                  : 'bg-slate-900/40 text-slate-600 border-slate-800'
                            }`}
                            title={`Click to filter log stream by ${meta.label}`}
                          >
                            <span>{meta.label}</span>
                            <span className="px-1 rounded-full bg-slate-950/60 text-[8.5px]">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-between gap-2 border-b border-slate-800/50 pb-2">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xxs font-mono text-slate-500">Filter Level:</span>
                  <div className="flex space-x-1">
                    {['ALL', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'].map(level => (
                      <button
                        key={level}
                        onClick={() => setLogFilter(level as any)}
                        className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase ${
                          logFilter === level 
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    id="btn-toggle-live-log-stream"
                    onClick={() => setIsLiveStreaming(prev => !prev)}
                    className={`rounded px-2 py-1 font-mono text-[9px] font-semibold uppercase flex items-center space-x-1 border transition-all cursor-pointer shadow ${
                      isLiveStreaming
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 font-extrabold shadow-emerald-500/10'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                    title="Simulate live WebSocket log stream for selected infrastructure node"
                  >
                    <Icons.Radio className={`h-3 w-3 ${isLiveStreaming ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                    <span>{isLiveStreaming ? `Live WS Stream (${streamRxCount})` : 'Live WS Stream OFF'}</span>
                  </button>

                  <button
                    id="btn-diff-view-toggle"
                    onClick={() => setIsDiffViewActive(prev => !prev)}
                    className={`rounded px-2 py-1 font-mono text-[9px] font-semibold uppercase flex items-center space-x-1 border transition-all cursor-pointer ${
                      isDiffViewActive 
                        ? 'bg-indigo-600 border-indigo-400 text-white font-bold shadow-md shadow-indigo-600/30 ring-2 ring-indigo-500/20' 
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                    title="Toggle side-by-side log segment Diff View comparison"
                  >
                    <Icons.GitCompare className="h-3 w-3 text-indigo-300" />
                    <span>Diff View: {isDiffViewActive ? 'ON' : 'OFF'}</span>
                  </button>

                  <button
                    id="btn-auto-scroll-toggle"
                    onClick={() => setAutoScrollLogs(prev => !prev)}
                    className={`rounded px-2 py-1 font-mono text-[9px] font-semibold uppercase flex items-center space-x-1 border transition-all cursor-pointer ${
                      autoScrollLogs 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold' 
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                    title="Keep log window scrolled to latest incoming entries"
                  >
                    <Icons.ArrowDown className={`h-2.5 w-2.5 ${autoScrollLogs ? 'animate-bounce' : ''}`} />
                    <span>Auto-Scroll: {autoScrollLogs ? 'ON' : 'OFF'}</span>
                  </button>

                  <button
                    id="btn-suggest-log-filters"
                    onClick={handleSuggestLogFilters}
                    disabled={isSuggestingFilters}
                    className="rounded px-2 py-1 font-mono text-[9px] font-semibold uppercase flex items-center space-x-1 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-all cursor-pointer shadow"
                    title="Use Gemini API to analyze current log lines and propose relevant query filters"
                  >
                    <Icons.Sparkles className={`h-3 w-3 text-amber-400 ${isSuggestingFilters ? 'animate-spin' : ''}`} />
                    <span>{isSuggestingFilters ? 'Analyzing...' : 'Suggest Filter'}</span>
                  </button>

                  <div className="relative">
                    <Icons.Search className="absolute left-2 top-2 h-3 w-3 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search traces..."
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      className="rounded bg-slate-900 border border-slate-800 py-1 pl-6 pr-2 text-[10px] text-white placeholder-slate-600 outline-none w-36 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* SUGGESTED FILTER CHIPS BAR */}
              {suggestedFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-indigo-950/40 border border-indigo-500/20 rounded-lg text-xxs font-mono">
                  <span className="text-amber-400 font-bold flex items-center space-x-1 mr-1">
                    <Icons.Sparkles className="h-3 w-3 text-amber-400" />
                    <span>Gemini Suggested Query Filters:</span>
                  </span>
                  {suggestedFilters.map(filter => (
                    <button
                      key={filter}
                      onClick={() => setLogSearch(filter)}
                      className="px-2 py-0.5 rounded bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 hover:text-white font-mono text-[9px] cursor-pointer transition-all flex items-center space-x-1"
                      title={`Click to filter logs by "${filter}"`}
                    >
                      <Icons.Filter className="h-2.5 w-2.5 text-indigo-400" />
                      <span>{filter}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => setSuggestedFilters([])}
                    className="text-slate-500 hover:text-slate-300 ml-auto text-[9px]"
                  >
                    Clear
                  </button>
                </div>
              )}

              {/* LIVE WEBSOCKET LOG STREAM STATUS BANNER */}
              {isLiveStreaming && (
                <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-950/60 border border-emerald-500/30 rounded-lg text-xxs font-mono text-emerald-300 shadow-lg animate-pulse">
                  <div className="flex items-center space-x-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="font-extrabold text-white">LIVE WEBSOCKET FEED ACTIVE</span>
                    <span className="text-emerald-400/80">• Node: <code className="bg-slate-900 px-1 py-0.5 rounded border border-emerald-500/30 text-white">{selectedIncident.appName.toLowerCase()}-live-ws-01</code></span>
                  </div>
                  <div className="flex items-center space-x-3 text-[9px]">
                    <span>Rx Packets: <strong className="text-white">{streamRxCount}</strong></span>
                    <span>Interval: <strong>2.5s</strong></span>
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-300 font-bold border border-emerald-500/30">WS 200 CONNECTED</span>
                  </div>
                </div>
              )}
              {isDiffViewActive ? (
                <div className="space-y-2.5 rounded-xl border border-indigo-500/30 bg-slate-950/90 p-3 shadow-2xl">
                  {/* Preset Selector & Diff Stats Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[9px] font-mono font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                        <Icons.GitCompare className="h-3 w-3" />
                        <span>Log Segment Diff Presets:</span>
                      </span>
                      <button
                        onClick={() => setDiffPreset('baseline_vs_peak')}
                        className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-all cursor-pointer ${
                          diffPreset === 'baseline_vs_peak'
                            ? 'bg-indigo-600 border-indigo-400 text-white font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Nominal Baseline vs Outage Peak
                      </button>
                      <button
                        onClick={() => setDiffPreset('node1_vs_node2')}
                        className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-all cursor-pointer ${
                          diffPreset === 'node1_vs_node2'
                            ? 'bg-indigo-600 border-indigo-400 text-white font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Node-01 vs Node-02 Replica
                      </button>
                      <button
                        onClick={() => setDiffPreset('custom')}
                        className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-all cursor-pointer ${
                          diffPreset === 'custom'
                            ? 'bg-indigo-600 border-indigo-400 text-white font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Custom Lines
                      </button>
                    </div>

                    {/* Diff Metrics Counter Pills */}
                    <div className="flex items-center space-x-2 text-[9px] font-mono">
                      <span className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded font-bold">
                        +3 Additions / Errors
                      </span>
                      <span className="bg-rose-950/80 border border-rose-500/40 text-rose-300 px-2 py-0.5 rounded font-bold">
                        -2 Deletions / Absent Baseline
                      </span>
                      <span className="bg-amber-950/80 border border-amber-500/40 text-amber-300 px-2 py-0.5 rounded font-bold">
                        ~1 State Modification
                      </span>
                    </div>
                  </div>

                  {/* Side by Side Log Comparison Columns */}
                  <div className="grid grid-cols-2 gap-3 text-[10px] font-mono max-h-[220px] overflow-y-auto custom-scrollbar">
                    {/* LEFT COLUMN: Segment A (Baseline) */}
                    <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-950 p-2.5">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1 text-slate-300">
                          <Icons.Clock className="h-3 w-3 text-emerald-400" />
                          <span>Segment A: Nominal Baseline (02:10:00)</span>
                        </span>
                        <span className="text-slate-500">Source: k8s-node-01</span>
                      </div>

                      <div className="space-y-1 pt-1">
                        <div className="p-1 rounded bg-slate-900/60 text-slate-300 border-l-2 border-slate-600 flex items-start space-x-1.5">
                          <span className="text-slate-500 select-none">1</span>
                          <span>[02:10:00] [INFO] [ingress-gateway] HTTP 200 GET /api/v1/checkout - 24ms - 100</span>
                        </div>
                        <div className="p-1 rounded bg-slate-900/60 text-slate-300 border-l-2 border-slate-600 flex items-start space-x-1.5">
                          <span className="text-slate-500 select-none">2</span>
                          <span>[02:10:05] [INFO] [{selectedIncident.appName}] Connection pool: 4/50 active connections</span>
                        </div>
                        <div className="p-1 rounded bg-rose-950/40 text-rose-300 border-l-2 border-rose-500/80 flex items-start space-x-1.5">
                          <span className="text-rose-500 font-bold select-none">- 3</span>
                          <span>[02:10:10] [INFO] [redis-cache] Cache hit ratio 98.4% (Nominal Baseline State)</span>
                        </div>
                        <div className="p-1 rounded bg-slate-900/60 text-slate-300 border-l-2 border-slate-600 flex items-start space-x-1.5">
                          <span className="text-slate-500 select-none">4</span>
                          <span>[02:10:15] [INFO] [k8s-autoscale] Replicas stable at 4 pods</span>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: Segment B (Peak Incident Failure) */}
                    <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-950 p-2.5">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1 text-rose-300">
                          <Icons.AlertOctagon className="h-3 w-3 text-rose-400" />
                          <span>Segment B: Incident Outage Peak (02:12:45)</span>
                        </span>
                        <span className="text-rose-400 font-bold">Source: {selectedIncident.appName}</span>
                      </div>

                      <div className="space-y-1 pt-1">
                        <div className="p-1 rounded bg-amber-950/40 text-amber-300 border-l-2 border-amber-500 flex items-start space-x-1.5">
                          <span className="text-amber-500 font-bold select-none">~ 1</span>
                          <span>[02:12:45] [ERROR] [ingress-gateway] HTTP 502 Bad Gateway /api/v1/checkout - 3200ms - 502</span>
                        </div>
                        <div className="p-1 rounded bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500 flex items-start space-x-1.5">
                          <span className="text-emerald-400 font-bold select-none">+ 2</span>
                          <span>[02:12:50] [FATAL] [{selectedIncident.appName}] Connection pool exhausted: 50/50 blocked by DB lock</span>
                        </div>
                        <div className="p-1 rounded bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500 flex items-start space-x-1.5">
                          <span className="text-emerald-400 font-bold select-none">+ 3</span>
                          <span>[02:12:55] [FATAL] [k8s-pod-monitor] OOMKilled: Pod {selectedIncident.appName}-7f99b exited (Code 137)</span>
                        </div>
                        <div className="p-1 rounded bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500 flex items-start space-x-1.5">
                          <span className="text-emerald-400 font-bold select-none">+ 4</span>
                          <span>[02:13:00] [WARN] [redis-cache] Memory eviction threshold exceeded: 95.2% memory capacity</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* STANDARD SINGLE LOG STREAM VIEW */
                <div ref={logContainerRef} className="rounded-lg border border-slate-900 bg-slate-950/80 p-3 font-mono text-[10px] leading-relaxed space-y-1.5 max-h-[220px] overflow-y-auto select-text">
                  {filteredLogs.map((line, i) => {
                    const isErr = line.level === 'FATAL' || line.level === 'ERROR';
                    const isWarn = line.level === 'WARN';
                    
                    const pattern = detectLogErrorPattern(line.message, line.level);
                    const patternMeta = ERROR_PATTERN_META[pattern];
                    const containsCritical = pattern !== 'NONE' || isErr;

                    const lineInsights = customActionableInsights.filter(
                      ins => ins.incidentId === selectedIncident.id && ins.logLine === line.message
                    );

                    const isAddingInsight = insightInputIndex === i;

                    const logLineContent = (
                      <div className={`flex flex-col space-y-1 w-full group/log rounded p-1.5 transition-all ${patternMeta.borderClass} ${patternMeta.bgClass}`}>
                        <div className="flex items-start justify-between space-x-2 w-full">
                          <div className="flex items-start space-x-2 flex-1 flex-wrap sm:flex-nowrap">
                            <div className="flex items-center space-x-1 shrink-0 text-slate-600 font-mono text-[9px]">
                              <span>{line.timestamp.slice(11, 19)}</span>
                              <span className="text-indigo-400/90 font-medium" title="Time elapsed relative to incident start">({getRelativeTimestamp(line.timestamp, selectedIncident.createdAt)})</span>
                            </div>
                            <span className={`shrink-0 font-bold ${
                              isErr ? 'text-rose-500' : isWarn ? 'text-amber-500' : 'text-slate-400'
                            }`}>
                              [{line.level}]
                            </span>
                            <span className="text-slate-500 font-semibold shrink-0">[{line.source}]</span>
                            
                            {pattern !== 'NONE' && (
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border shrink-0 ${patternMeta.badgeClass}`}>
                                [{patternMeta.label}]
                              </span>
                            )}

                            <span className={isErr ? 'text-rose-300 font-semibold break-all' : 'text-slate-300 break-all'}>
                              {highlightLogMessage(line.message)}
                            </span>
                          </div>

                          <button
                            onClick={() => {
                              if (insightInputIndex === i) {
                                setInsightInputIndex(null);
                              } else {
                                setInsightInputIndex(i);
                                setInsightText('');
                              }
                            }}
                            className="opacity-0 group-hover/log:opacity-100 transition-opacity px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono text-[8.5px] shrink-0 cursor-pointer flex items-center space-x-1"
                            title="Highlight log segment & attach Actionable Insight label"
                          >
                            <Icons.Tag className="h-2.5 w-2.5 text-amber-400" />
                            <span>+ Insight</span>
                          </button>
                        </div>

                        {/* Display Attached Actionable Insights */}
                        {lineInsights.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pl-6 pt-0.5">
                            {lineInsights.map(ins => (
                              <div
                                key={ins.id}
                                className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-200 text-[8.5px] font-mono flex items-center space-x-1 shadow-sm"
                              >
                                <Icons.Sparkles className="h-2.5 w-2.5 text-amber-400 shrink-0" />
                                <span className="font-bold uppercase tracking-wider text-amber-400">[Insight]:</span>
                                <span>{ins.text}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Inline Input Box to Attach Actionable Insight */}
                        {isAddingInsight && (
                          <div className="flex items-center space-x-2 pl-6 py-1">
                            <input
                              type="text"
                              placeholder="Enter Actionable Insight label (e.g. [ROOT CAUSE] DB connection lock)..."
                              value={insightText}
                              onChange={(e) => setInsightText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddActionableInsight(line.message);
                              }}
                              className="flex-1 rounded bg-slate-900 border border-amber-500/50 px-2 py-0.5 text-[9.5px] text-amber-200 placeholder-slate-500 outline-none font-mono"
                              autoFocus
                            />
                            <button
                              onClick={() => handleAddActionableInsight(line.message)}
                              className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-mono text-[9px] font-bold cursor-pointer"
                            >
                              Save Insight
                            </button>
                            <button
                              onClick={() => setInsightInputIndex(null)}
                              className="px-1.5 py-0.5 text-slate-400 hover:text-slate-200 text-[9px] font-mono cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    );

                    if (containsCritical) {
                      return (
                        <motion.div
                          key={i}
                          initial={{ backgroundColor: "rgba(239, 68, 68, 0.12)", boxShadow: "0 0 10px rgba(239, 68, 68, 0.25)" }}
                          animate={{ backgroundColor: "rgba(0, 0, 0, 0)", boxShadow: "0 0 0px rgba(0,0,0,0)" }}
                          transition={{ duration: 2.5, ease: "easeOut" }}
                          className="rounded px-1.5 py-0.5 border border-rose-500/10"
                        >
                          {logLineContent}
                        </motion.div>
                      );
                    }

                    return (
                      <div key={i} className="px-1.5 py-0.5">
                        {logLineContent}
                      </div>
                    );
                  })}
                  {filteredLogs.length === 0 && (
                    <div className="text-center py-4 text-slate-500">No telemetry log traces matched your search query.</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: METRICS METERS */}
          {telemetryTab === 'metrics' && (
            <div className="grid grid-cols-1 gap-3">
              {selectedIncident.metrics.map((met, idx) => (
                <div key={idx}>
                  {renderSvgMetricChart(met.points, met.label, met.unit)}
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: JAEGER SPANS DISTRIBUTED TRACING */}
          {telemetryTab === 'traces' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xxs font-mono text-slate-500 border-b border-slate-800/50 pb-2">
                <span>Span Pipeline View</span>
                <span>TraceID: 4a21e428e9c12b</span>
              </div>
              
              <div className="rounded-lg border border-slate-900 bg-slate-950/80 p-4 font-mono space-y-3.5 select-text">
                {/* Visual Jaeger Flame trace line items */}
                {selectedIncident.traces.map((node) => {
                  const renderTraceNode = (n: any, depth = 0) => {
                    const hasError = n.status === 'ERROR';
                    const hasWarn = n.status === 'WARNING';
                    return (
                      <div key={n.id} className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <div className="flex items-center space-x-2" style={{ paddingLeft: `${depth * 14}px` }}>
                            <Icons.ChevronRight className={`h-3 w-3 text-slate-500 ${depth > 0 ? 'opacity-50' : ''}`} />
                            <span className={`font-semibold ${hasError ? 'text-rose-400' : hasWarn ? 'text-amber-400' : 'text-indigo-300'}`}>
                              {n.name}
                            </span>
                          </div>
                          <span className={`text-[9px] font-bold ${hasError ? 'text-rose-400' : 'text-slate-500'}`}>{n.durationMs}ms</span>
                        </div>
                        {/* Shaded horizontal timeline bar */}
                        <div className="relative h-2 w-full rounded bg-slate-900 overflow-hidden" style={{ marginLeft: `${depth * 14}px`, width: `calc(100% - ${depth * 14}px)` }}>
                          <div 
                            className={`absolute top-0 bottom-0 rounded ${
                              hasError ? 'bg-rose-500' : hasWarn ? 'bg-amber-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${Math.min(100, (n.durationMs / 30000) * 100)}%` }}
                          />
                        </div>
                        {n.children?.map((c: any) => renderTraceNode(c, depth + 1))}
                      </div>
                    );
                  };
                  return renderTraceNode(node);
                })}
              </div>
            </div>
          )}

          {/* TAB 4: DATABASE CONSOLE */}
          {telemetryTab === 'db' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center font-mono text-[10px]">
                <div className="rounded bg-slate-900/60 p-2 border border-slate-800">
                  <div className="text-slate-500">POOL CONNS</div>
                  <div className="text-sm font-bold text-indigo-400">{selectedIncident.dbState.connectionsActive} / {selectedIncident.dbState.poolLimit}</div>
                </div>
                <div className="rounded bg-slate-900/60 p-2 border border-slate-800">
                  <div className="text-slate-500">ACTIVE LOCKS</div>
                  <div className={`text-sm font-bold ${selectedIncident.dbState.locksCount > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                    {selectedIncident.dbState.locksCount}
                  </div>
                </div>
                <div className="rounded bg-slate-900/60 p-2 border border-slate-800">
                  <div className="text-slate-500">SLOW QUERIES</div>
                  <div className="text-sm font-bold text-amber-400">{selectedIncident.dbState.slowQueries.length}</div>
                </div>
              </div>

              {/* Slow Queries list */}
              {selectedIncident.dbState.slowQueries.length > 0 && (
                <div className="rounded-lg border border-slate-900 bg-slate-950/80 p-3 font-mono text-[10px] space-y-1.5">
                  <div className="text-[9px] font-bold text-rose-400 uppercase tracking-wider">Slow transaction queries detected:</div>
                  {selectedIncident.dbState.slowQueries.map((q, i) => (
                    <div key={i} className="border-l border-rose-500/30 pl-2">
                      <div className="text-slate-300 truncate">{q.query}</div>
                      <div className="text-[9px] text-slate-500 mt-0.5">Execution latency: {q.durationMs}ms</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Interactive SQL Sandbox */}
              <form onSubmit={handleRunSQL} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xxs font-semibold text-slate-300">Live PostgreSQL query terminal</span>
                  <span className="text-[9px] text-slate-500 font-mono">write lock access active</span>
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="SELECT pg_terminate_backend(blocking_pid) from pg_stat_activity..."
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    className="flex-1 rounded border border-slate-800 bg-slate-950 p-2 font-mono text-[10px] text-emerald-400 outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={isSqlRunning || !sqlQuery.trim()}
                    className="rounded bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-500"
                  >
                    {isSqlRunning ? 'Running...' : 'Execute'}
                  </button>
                </div>
                {sqlResults && (
                  <pre className="mt-2.5 rounded bg-slate-950 p-2.5 font-mono text-[9px] text-indigo-300 overflow-x-auto border border-indigo-500/10">
                    {sqlResults}
                  </pre>
                )}
              </form>
            </div>
          )}

          {/* TAB 5: KUBERNETES ARGO DEPLOYMENTS */}
          {telemetryTab === 'k8s' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xxs font-mono text-slate-500 border-b border-slate-800/50 pb-2">
                <span>Active ArgoCD Pod Manifest</span>
                <span>Namespace: production-prod-1</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Simulated Pod health */}
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 font-mono space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 text-[10px]">
                    <span className="font-bold text-white">billing-core-7ff5d</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                      selectedIncident.id === 'inc_001' && selectedIncident.status !== 'SOLVED'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {selectedIncident.id === 'inc_001' && selectedIncident.status !== 'SOLVED' ? 'OOMKilled' : 'Running'}
                    </span>
                  </div>
                  <div className="text-[10px] space-y-1 text-slate-300">
                    <div>Replicas: <span className="text-white">1 / 1</span></div>
                    <div>CPU Limit: <span className="text-white">500m</span></div>
                    <div>RAM Allocation: <span className="text-white">1.5Gi (Starved)</span></div>
                    <div>Exit Code: <span className="text-rose-400">{selectedIncident.id === 'inc_001' && selectedIncident.status !== 'SOLVED' ? '137' : '0'}</span></div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 font-mono space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 text-[10px]">
                    <span className="font-bold text-white">checkout-gate-4d1a</span>
                    <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Running
                    </span>
                  </div>
                  <div className="text-[10px] space-y-1 text-slate-300">
                    <div>Replicas: <span className="text-white">2 / 2</span></div>
                    <div>CPU Limit: <span className="text-white">1000m</span></div>
                    <div>RAM Allocation: <span className="text-white">4.0Gi</span></div>
                    <div>Exit Code: <span className="text-emerald-400">0</span></div>
                  </div>
                </div>
              </div>

              {/* Argo Sync status */}
              <div className="rounded-lg border border-slate-900 bg-slate-950/80 p-3.5 text-slate-300 font-mono text-[10px]">
                <div className="flex items-center space-x-2 text-emerald-400 font-bold mb-1">
                  <Icons.CheckCircle2 className="h-4 w-4" />
                  <span>ArgoCD GitOps Sync: InSync</span>
                </div>
                <p className="text-slate-500">Last deployed commit: <span className="text-indigo-400">v2.14.3 (df8921a)</span> by eshan-cto 24 hours ago.</p>
              </div>
            </div>
          )}

          {/* TAB 6: TOPOLOGY RELATIONSHIP DEPENDENCY GRAPH */}
          {telemetryTab === 'topology' && (
            <div className="space-y-3.5">
              <IncidentD3Map incident={selectedIncident} />
              <IncidentDependencyGraph selectedIncident={selectedIncident} />
            </div>
          )}

          {/* TAB 7: CHRONOLOGICAL INVESTIGATION TIMELINE */}
          {telemetryTab === 'timeline' && (
            <div className="space-y-4">
              <InteractiveIncidentTimeline
                incident={selectedIncident}
                customActionableInsights={customActionableInsights.filter(i => i.incidentId === selectedIncident.id)}
                onAddNote={(note) => {
                  setQuickNote(note);
                  window.dispatchEvent(new CustomEvent('show-toast', {
                    detail: { message: `Note pre-filled into quick note bar.` }
                  }));
                }}
              />

              {/* VERTICAL INCIDENT LIFECYCLE TIMELINE COMPONENT */}
              <IncidentLifecycleTimeline incident={selectedIncident} />

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/50 pb-3 pt-2">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                    <Icons.History className="h-4 w-4 text-indigo-400" />
                    <span>Comprehensive Investigation Log Stream Chronology</span>
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">Chronologically ordered milestones, diagnostic notes, and log anomalies</p>
                </div>
                
                {/* Timeline filter chips */}
                <div className="flex items-center space-x-1">
                  {(['all', 'logs', 'notes', 'system'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setTimelineFilter(filter)}
                      className={`rounded px-2 py-0.5 text-[9px] font-mono font-bold uppercase transition-all cursor-pointer ${
                        timelineFilter === filter
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search timeline input */}
              <div className="relative">
                <Icons.Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search chronological event titles, logs, or system milestones..."
                  value={timelineSearch}
                  onChange={(e) => setTimelineSearch(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 py-2 pl-9 pr-3 text-[10px] text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-all shadow-inner"
                />
              </div>

              {/* Vertical timeline line with items */}
              <div className="relative border-l border-slate-800 ml-4 pl-6 space-y-6 pt-2 pb-4">
                {(() => {
                  let filteredEvents = getUnifiedTimeline();
                  
                  // Filter by category
                  if (timelineFilter !== 'all') {
                    if (timelineFilter === 'logs') {
                      filteredEvents = filteredEvents.filter(e => e.category === 'log');
                    } else if (timelineFilter === 'notes') {
                      filteredEvents = filteredEvents.filter(e => e.category === 'note');
                    } else if (timelineFilter === 'system') {
                      filteredEvents = filteredEvents.filter(e => e.category === 'system' || e.category === 'status');
                    }
                  }

                  // Filter by search text
                  if (timelineSearch.trim()) {
                    const q = timelineSearch.toLowerCase();
                    filteredEvents = filteredEvents.filter(e => 
                      e.title.toLowerCase().includes(q) || 
                      e.description.toLowerCase().includes(q)
                    );
                  }

                  if (filteredEvents.length === 0) {
                    return (
                      <div className="text-center py-8 font-mono text-[10px] text-slate-600">
                        No events found matching current filter/search constraints.
                      </div>
                    );
                  }

                  return filteredEvents.map((evt) => {
                    const isNote = evt.category === 'note';
                    const isLog = evt.category === 'log';

                    return (
                      <div key={evt.id} className="relative group/timeline-item">
                        {/* Connecting dot with glowing rings on hover */}
                        <div className={`absolute -left-[29.5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 bg-slate-950 transition-all duration-300 group-hover/timeline-item:scale-125 z-10 ${
                          isNote 
                            ? 'border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' 
                            : isLog 
                              ? evt.type === 'FATAL' || evt.type === 'ERROR'
                                ? 'border-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
                                : 'border-indigo-500'
                              : 'border-amber-500'
                        }`} />
                        
                        {/* Event Content card */}
                        <div className="rounded-xl border border-slate-800/40 bg-slate-900/10 p-3 hover:bg-slate-900/35 hover:border-slate-800/80 transition-all duration-300 shadow-sm relative overflow-hidden">
                          {/* Top row with meta info */}
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-[9px] text-slate-500 flex items-center space-x-1.5">
                              <Icons.Clock className="h-3 w-3 text-slate-600" />
                              <span>{evt.timestamp.includes('T') ? evt.timestamp.slice(11, 19) : evt.timestamp}</span>
                              <span className="text-slate-700">•</span>
                              <span className="text-[8px] font-bold uppercase tracking-wider px-1 rounded border border-slate-800 bg-slate-950 text-slate-500">
                                {evt.category}
                              </span>
                            </span>
                            <span className={`font-mono text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${evt.badgeColor}`}>
                              {evt.type}
                            </span>
                          </div>

                          <h4 className="font-semibold text-white text-[11px] font-sans group-hover/timeline-item:text-indigo-400 transition-colors leading-tight">{evt.title}</h4>
                          <p className="text-slate-400 font-mono text-[9.5px] leading-relaxed mt-1 select-text break-words">
                            {highlightLogMessage(evt.description)}
                          </p>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* TAB 8: MULTI-USER SUPPORT TEAM STICKY NOTES */}
          {telemetryTab === 'sticky_notes' && (
            <IncidentStickyNotes incidentId={selectedIncident.id} />
          )}

          {/* TAB 9: STATUS HISTORY TIMELINE */}
          {telemetryTab === 'status_history' && (
            <div className="space-y-4">
              <div className="flex items-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/50 pb-3">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                    <Icons.GitCommit className="h-4 w-4 text-indigo-400" />
                    <span>State Transition Log & SLA Milestones</span>
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">Audit-grade chronological trace of status modifications and operator handoffs</p>
                </div>
              </div>

              <div className="relative border-l border-slate-800 ml-4 pl-6 space-y-6 pt-2 pb-4">
                {getStatusHistory(selectedIncident).map((hist, idx) => {
                  const statusColors = {
                    OPEN: 'border-rose-500 bg-rose-500/10 text-rose-400',
                    INVESTIGATING: 'border-indigo-500 bg-indigo-500/10 text-indigo-400',
                    ESCALATED: 'border-amber-500 bg-amber-500/10 text-amber-400',
                    SOLVED: 'border-emerald-500 bg-emerald-500/10 text-emerald-400',
                  };

                  return (
                    <div key={idx} className="relative group/status-item">
                      {/* Connecting dot */}
                      <div className={`absolute -left-[29.5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 bg-slate-950 transition-all duration-300 z-10 ${
                        hist.status === 'SOLVED' 
                          ? 'border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' 
                          : hist.status === 'ESCALATED'
                            ? 'border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                            : hist.status === 'INVESTIGATING'
                              ? 'border-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]'
                              : 'border-rose-500'
                      }`} />

                      <div className="rounded-xl border border-slate-800/40 bg-slate-900/10 p-3 hover:bg-slate-900/35 hover:border-slate-800/80 transition-all duration-300 shadow-sm">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`px-2 py-0.5 rounded text-[8.5px] font-mono font-bold border ${statusColors[hist.status]}`}>
                            {hist.status}
                          </span>
                          <span className="text-[9px] font-mono text-slate-500">
                            {new Date(hist.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-xxs text-slate-300 font-sans leading-relaxed">
                          {hist.message || `Incident transitioned status to ${hist.status}.`}
                        </div>
                        <div className="mt-2 flex items-center space-x-1.5 text-[9px] font-mono text-slate-500 border-t border-slate-800/20 pt-1.5">
                          <Icons.User className="h-3 w-3 text-slate-500" />
                          <span>Operator:</span>
                          <span className="text-slate-400 font-semibold">{hist.changedBy}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 3. AI INVESTIGATION BOARD (Telemetry Analysis Panel Right) */}
      <div className="col-span-4 flex flex-col overflow-y-auto space-y-4">
        
        {/* Suggested Correlation Sidebar Panel */}
        <div className="rounded-xl border border-slate-900 bg-slate-950 p-4 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-900 pb-2">
            <h4 className="font-display font-semibold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5 text-white">
              <Icons.GitMerge className="h-4 w-4 text-indigo-400 animate-pulse" />
              <span>Suggested Correlation Panel</span>
            </h4>
            
            <div className="relative group/correlation">
              <Icons.HelpCircle className="h-3.5 w-3.5 text-slate-500 hover:text-white transition-colors cursor-pointer" />
              <div className="absolute right-0 top-full mt-2 hidden group-hover/correlation:block z-50 w-56 rounded-xl border border-slate-800 bg-slate-950 p-3 text-[9px] font-mono text-slate-400 shadow-xl leading-normal pointer-events-none">
                <div className="font-bold text-white mb-1 uppercase tracking-wider text-[8px] flex items-center space-x-1">
                  <Icons.Cpu className="h-2.5 w-2.5 text-indigo-400" />
                  <span>Overlap Scoring Model</span>
                </div>
                <p className="text-slate-400 font-sans leading-relaxed">
                  Scans tenant client mappings, service tags, logging exceptions, and alert timestamps within a 24h operational window to recommend related high-context failure tickets.
                </p>
                <div className="absolute bottom-full right-1 border-4 border-transparent border-b-slate-800" />
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 leading-relaxed">
            Overlapping network metrics, tenant profiles, and alarm patterns:
          </div>

          <div className="space-y-2.5">
            {(() => {
              const correlated = getCorrelatedIncidents(selectedIncident);
              if (correlated.length === 0) {
                return (
                  <div className="text-center py-4 bg-slate-900/10 border border-slate-900/60 rounded-lg text-slate-500 font-mono text-[9px]">
                    No overlapping incidents detected in the current 24-hour cycle.
                  </div>
                );
              }

              return correlated.map(({ incident, matchPercentage, reasons }) => (
                <div 
                  key={incident.id} 
                  onClick={() => {
                    setSelectedIncident(incident);
                    setDrawerIncidentId(incident.id);
                  }}
                  className="bg-slate-900/20 border border-slate-900 hover:border-indigo-500/30 hover:bg-slate-900/40 rounded-lg p-2.5 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[9px] text-indigo-400 font-bold group-hover:underline">{incident.id}</span>
                    <span className="text-[9px] font-mono text-emerald-400 font-bold bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10">
                      {matchPercentage}% Overlap
                    </span>
                  </div>
                  <h5 className="text-[10.5px] font-semibold text-slate-200 line-clamp-1 leading-normal mb-1">{incident.title}</h5>
                  <div className="space-y-0.5 pl-1.5 border-l border-slate-800">
                    {reasons.map((reason, idx) => (
                      <div key={idx} className="flex items-start space-x-1 font-mono text-[8.5px] text-slate-500 leading-tight">
                        <span className="text-indigo-500">•</span>
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Incident Forecasting Module */}
        <div className="rounded-xl border border-slate-900 bg-slate-950 p-4 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-900 pb-2">
            <h4 className="font-display font-semibold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5 text-white">
              <Icons.LineChart className="h-4 w-4 text-indigo-400 animate-pulse" />
              <span>Predictive Incident Forecasting</span>
            </h4>
            
            {/* Tooltip Icon & Popover */}
            <div className="relative group/forecasting">
              <Icons.HelpCircle className="h-3.5 w-3.5 text-slate-500 hover:text-white transition-colors cursor-pointer" />
              <div className="absolute right-0 top-full mt-2 hidden group-hover/forecasting:block z-50 w-52 rounded-xl border border-slate-800 bg-slate-950 p-3 text-[9px] font-mono text-slate-400 shadow-xl leading-normal pointer-events-none">
                <div className="font-bold text-white mb-1 uppercase tracking-wider text-[8px] flex items-center space-x-1">
                  <Icons.Cpu className="h-2.5 w-2.5 text-indigo-400" />
                  <span>Least-Squares Linear Model</span>
                </div>
                <p className="text-slate-400 font-sans leading-relaxed">
                  Applies standard linear regression coefficients (y = mx + b) over historical SLA exception logs and database lock telemetry to project container OOM bottlenecks.
                </p>
                <div className="absolute bottom-full right-1 border-4 border-transparent border-b-slate-800" />
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 leading-relaxed">
            AI-driven linear regression analyzing the last 6 operational logging cycles to predict capacity bottlenecks and outages:
          </div>

          {/* Forecasting Trend Graph (Rendered natively via SVG for safety and exact design control) */}
          {(() => {
            const forecast = calculateIncidentForecast();
            const points = [...forecast.history.map(h => h.count), ...forecast.projections.map(p => p.projectedCount)];
            const maxVal = Math.max(...points, 12);
            
            const width = 280;
            const height = 90;
            const padding = 15;
            const chartWidth = width - padding * 2;
            const chartHeight = height - padding * 2;
            const stepX = chartWidth / (points.length - 1);

            return (
              <div className="relative bg-slate-950/80 p-2 rounded-lg border border-slate-900/60 font-mono text-[8px]">
                <div className="absolute top-1 right-2 flex space-x-2 text-[7px] text-slate-500 uppercase">
                  <span className="flex items-center space-x-1">
                    <span className="h-1.5 w-1.5 bg-slate-600 rounded-full" />
                    <span>History</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-pulse" />
                    <span>Forecast</span>
                  </span>
                </div>
                
                <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
                  {/* Subtle horizontal grid lines */}
                  {[0.25, 0.5, 0.75, 1].map((r, i) => (
                    <line
                      key={i}
                      x1={padding}
                      y1={padding + chartHeight * (1 - r)}
                      x2={width - padding}
                      y2={padding + chartHeight * (1 - r)}
                      stroke="rgba(255,255,255,0.03)"
                      strokeWidth="1"
                    />
                  ))}

                  {/* Draw History Path (first 6 points) */}
                  <path
                    d={forecast.history.map((pt, i) => {
                      const x = padding + i * stepX;
                      const y = padding + chartHeight * (1 - pt.count / maxVal);
                      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                    }).join(' ')}
                    fill="none"
                    stroke="#475569"
                    strokeWidth="1.5"
                  />

                  {/* Draw Forecast Path (next 3 points) */}
                  <path
                    d={[forecast.history[forecast.history.length - 1], ...forecast.projections].map((pt, i) => {
                      const idx = forecast.history.length - 1 + i;
                      const x = padding + idx * stepX;
                      const val = 'count' in pt ? pt.count : pt.projectedCount;
                      const y = padding + chartHeight * (1 - val / maxVal);
                      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                    }).join(' ')}
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="1.5"
                    strokeDasharray="3,3"
                  />

                  {/* Draw points */}
                  {forecast.history.map((pt, i) => {
                    const x = padding + i * stepX;
                    const y = padding + chartHeight * (1 - pt.count / maxVal);
                    return (
                      <g key={i}>
                        <circle cx={x} cy={y} r="3" fill="#0f172a" stroke="#64748b" strokeWidth="1" />
                        {i % 2 === 0 && (
                          <text x={x} y={y - 6} fill="#64748b" textAnchor="middle" fontSize="6">{pt.count}</text>
                        )}
                      </g>
                    );
                  })}

                  {forecast.projections.map((pt, i) => {
                    const idx = forecast.history.length + i;
                    const x = padding + idx * stepX;
                    const y = padding + chartHeight * (1 - pt.projectedCount / maxVal);
                    return (
                      <g key={i}>
                        <circle cx={x} cy={y} r="3" fill="#0f172a" stroke="#818cf8" strokeWidth="1" />
                        <text x={x} y={y - 6} fill="#818cf8" textAnchor="middle" fontSize="6" fontWeight="bold">{pt.projectedCount}</text>
                      </g>
                    );
                  })}
                </svg>

                {/* Grid labels */}
                <div className="flex justify-between px-2 pt-1.5 text-slate-500 text-[7px] uppercase font-bold border-t border-slate-900">
                  <span>Cycle Start (06:00)</span>
                  <span className="text-indigo-400 font-black animate-pulse">Projection Horizon (+18h)</span>
                </div>
              </div>
            );
          })()}

          {/* Forecast Predictions / Bottlenecks Alert List */}
          <div className="space-y-2 font-mono text-[9px]">
            {calculateIncidentForecast().projections.map((proj, i) => {
              const isHigh = proj.riskLevel === 'HIGH' || proj.riskLevel === 'CRITICAL';
              return (
                <div
                  key={i}
                  className={`p-2 rounded-lg border flex flex-col space-y-1 ${
                    proj.riskLevel === 'CRITICAL'
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                      : proj.riskLevel === 'HIGH'
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                        : 'bg-slate-900/40 border-slate-900 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-white text-[9.5px] uppercase">{proj.timeLabel}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[7.5px] ${
                      proj.riskLevel === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-400'
                        : proj.riskLevel === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-slate-800 text-slate-400'
                    }`}>
                      {proj.riskLevel} RISK
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="leading-normal">
                        Predicted Outages: <strong className="text-white font-black">{proj.projectedCount}</strong> events/hr
                      </p>
                      <p className="text-[8px] text-slate-500 leading-normal mt-0.5">
                        Bottleneck: {proj.bottleneckSource}
                      </p>
                    </div>
                    {isHigh && (
                      <Icons.AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400 animate-pulse mt-0.5" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-900 text-[8.5px] text-slate-500 leading-normal font-mono flex items-start space-x-1.5">
            <Icons.Sparkles className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-300 uppercase block mb-0.5">Recommended Actions:</span>
              Pre-emptively expand <span className="text-white font-semibold">PostgreSQL pool limits</span> and trigger Garbage Collection on the billing pod replication controller to mitigate the forecasted bottleneck.
            </div>
          </div>
        </div>

        {/* Main Investigation Action card */}
        {!selectedIncident.analysis ? (
          <div className="rounded-xl border border-dashed border-indigo-500/30 bg-indigo-500/5 p-6 text-center space-y-4">
            <div className="mx-auto rounded-full bg-indigo-500/10 p-3.5 text-indigo-400 w-max animate-pulse-slow">
              <Icons.Cpu className="h-8 w-8" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm text-white">Autonomous Telemetry Correlation</h3>
              <p className="text-[10px] text-slate-400 max-w-xs mx-auto mt-1">
                The AI Root Cause Agent can automatically compile logs, traces, database locks, and K8s spec files to pinpoint the outage cause.
              </p>
            </div>
            <button
              onClick={handleRunInvestigation}
              disabled={isInvestigating}
              className="w-full py-2.5 bg-indigo-600 rounded-lg text-white font-bold tracking-wide hover:bg-indigo-500 transition-colors flex items-center justify-center space-x-2"
            >
              {isInvestigating ? (
                <>
                  <Icons.Loader2 className="h-4 w-4 animate-spin" />
                  <span>Correlating logs & metrics...</span>
                </>
              ) : (
                <>
                  <Icons.Zap className="h-4 w-4" />
                  <span>Run Autonomous AI Investigation</span>
                </>
              )}
            </button>

            {/* AI Reasoning logs */}
            {isInvestigating && (
              <div className="text-left bg-slate-950 p-3.5 rounded-lg border border-slate-800/80 font-mono text-[10px] space-y-2">
                <div className="text-slate-500 border-b border-slate-800 pb-1 flex items-center justify-between">
                  <span>LOGGING ENGINE ACTIVE</span>
                  <span className="animate-pulse text-indigo-400">● RUNNING</span>
                </div>
                <div className="space-y-1 text-slate-400 select-none">
                  {[
                    "Identifying customer profiles and SLA parameters...",
                    "Querying distributed microservice stack logs...",
                    "Matching trace durations with distributed Jaeger spans...",
                    "Inspecting PostgreSQL transaction lock indices...",
                    "Running semantic comparison with known historical runbooks...",
                    "Calling Gemini neural-reasoning model..."
                  ].map((step, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <span className={idx <= investigationStep ? 'text-indigo-400' : 'text-slate-700'}>
                        {idx < investigationStep ? '✓' : idx === investigationStep ? '➔' : '○'}
                      </span>
                      <span className={idx === investigationStep ? 'text-white font-semibold' : idx < investigationStep ? 'text-slate-500' : 'text-slate-700'}>
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3.5 text-left font-mono text-[10px] text-rose-300">
                <div className="flex items-center space-x-1.5 font-bold mb-1.5">
                  <Icons.AlertTriangle className="h-4 w-4" />
                  <span>Telemetry Interlock Failure</span>
                </div>
                <p className="mb-2 leading-relaxed">{errorMessage}</p>
                <div className="bg-rose-500/10 p-2 rounded text-xxs text-rose-400 leading-relaxed">
                  <span className="font-bold uppercase block mb-0.5">Recommended action:</span>
                  Please configure your <span className="font-mono text-white">GEMINI_API_KEY</span> inside the **Settings & Secrets** panel in AI Studio's sidebar.
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Detailed AI Correlation Output */
          <div className="space-y-4">
            
            {/* 1. Root Cause Summary card */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-display font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <Icons.Cpu className="h-4 w-4" />
                  <span>AI Investigation Results</span>
                </h4>
                
                <div className="flex items-center space-x-2.5">
                  <button
                    onClick={handleDownloadPDFReport}
                    className="rounded bg-indigo-600 hover:bg-indigo-500 hover:text-white px-2 py-0.5 font-mono text-[9px] font-bold text-white flex items-center space-x-1 transition-all cursor-pointer shadow-md shadow-indigo-600/15"
                    title="Download incident findings as formatted PDF report"
                  >
                    <Icons.Download className="h-2.5 w-2.5" />
                    <span>Download PDF</span>
                  </button>

                  <button
                    onClick={handleDownloadMarkdownReport}
                    className="rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-slate-600 hover:text-white px-2 py-0.5 font-mono text-[9px] font-bold text-slate-300 flex items-center space-x-1 transition-all cursor-pointer shadow-md"
                    title="Export current investigation summary and log correlation as MD report"
                  >
                    <Icons.FileCode className="h-2.5 w-2.5 text-indigo-400" />
                    <span>Export MD</span>
                  </button>

                  <div className="h-4 w-[1px] bg-slate-800" />

                  {/* Confidence Score meter */}
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] text-slate-500 font-mono">Confidence:</span>
                    <span className={`font-mono font-bold ${
                      selectedIncident.analysis.confidenceScore > 85 ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {selectedIncident.analysis.confidenceScore}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 font-sans leading-relaxed text-slate-300">
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Root Cause Diagnosis:</div>
                  <p className="mt-0.5 text-slate-200 select-text">{selectedIncident.analysis.rootCause}</p>
                </div>

                <div className="rounded-lg bg-slate-950/60 border border-slate-800/80 p-2.5">
                  <div className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wide mb-1">Recommended Remediation Script:</div>
                  <p className="font-mono text-[10px] text-emerald-400 bg-slate-900 px-2 py-1.5 rounded select-all">
                    {selectedIncident.analysis.suggestedFix}
                  </p>
                </div>

                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Cascading Risk Prediction:</div>
                  <p className="mt-0.5 text-slate-200 text-xxs leading-snug">{selectedIncident.analysis.riskPrediction}</p>
                </div>
              </div>
            </div>

            {/* 2. Interactive Automated Remediation execution board */}
            {selectedIncident.status !== 'SOLVED' && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <h4 className="mb-2.5 font-display font-bold text-xs text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <Icons.Play className="h-4 w-4" />
                  <span>Remediation Center</span>
                </h4>
                <p className="text-xxs text-slate-400 mb-3 leading-snug">
                  Execute the recommended remediation scripts instantly. Critical actions require electronic signatures and team clearance checkouts.
                </p>

                {actionSuccessMessage && (
                  <div className="mb-3 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-400 font-mono text-[10px] leading-relaxed">
                    {actionSuccessMessage}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => handleInitiateAction(selectedIncident.analysis?.suggestedFix || "Restart billing container")}
                    className="w-full py-2 bg-emerald-600 rounded-md text-white font-bold transition-colors hover:bg-emerald-500 flex items-center justify-center space-x-1.5 text-xxs"
                  >
                    <Icons.Zap className="h-3.5 w-3.5" />
                    <span>Run Automated Remediation</span>
                  </button>
                </div>
              </div>
            )}

            {/* 3. Composed Timeline */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
              <h4 className="mb-3.5 font-display font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Icons.History className="h-4 w-4" />
                <span>Outage Event Timeline</span>
              </h4>
              
              <div className="relative border-l border-slate-800 ml-2 pl-4 space-y-4">
                {selectedIncident.analysis.timeline.map((event, i) => (
                  <div key={i} className="relative">
                    {/* Circle icon on line */}
                    <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-indigo-500 bg-slate-950" />
                    
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>{event.timestamp ? event.timestamp.slice(11, 19) : "Telemetry Trigger"}</span>
                        {event.agent && <span className="text-indigo-400">[{event.agent}]</span>}
                      </div>
                      <h5 className="font-semibold text-white text-xxs">{event.title}</h5>
                      <p className="text-slate-400 text-[10px] leading-snug">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Automated reply composer box */}
            <div className="rounded-xl border border-slate-800/40 bg-slate-900/30 p-4">
              <h4 className="mb-2.5 font-display font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5 text-white">
                <Icons.Mail className="h-4 w-4 text-indigo-400" />
                <span>Customer Response Desk</span>
              </h4>
              <p className="text-xxs text-slate-500 mb-2.5 leading-snug">
                This reply was generated automatically to fit the target client channel:
              </p>

              {responseSuccessMessage && (
                <div className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-emerald-400 font-mono text-[10px] leading-relaxed animate-fadeIn">
                  {responseSuccessMessage}
                </div>
              )}

              <div className="mb-3">
                <label htmlFor="reply-template-select" className="block text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Select Reply Template
                </label>
                <div className="relative">
                  <select
                    id="reply-template-select"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        setResponseDraft(val);
                        window.dispatchEvent(new CustomEvent('show-toast', {
                          detail: { message: "Injected selected response template!" }
                        }));
                      }
                    }}
                    defaultValue=""
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-sans text-slate-300 py-2 pl-2.5 pr-8 appearance-none focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="" disabled>-- Inject a professional response block --</option>
                    {REPLY_TEMPLATES.map((tpl, i) => (
                      <option key={i} value={tpl.text}>
                        {tpl.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                    <Icons.ChevronDown className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>

              {/* Voice-To-Text Input Control */}
              <div className="mb-2.5">
                <VoiceTextInputWidget
                  onTranscript={(text) => setResponseDraft(prev => (prev ? prev + ' ' + text : text))}
                  onCommand={(cmd, val) => {
                    if (cmd === 'SET_STATUS' && val) {
                      setIncidents(prev => prev.map(inc => inc.id === selectedIncident.id ? { ...inc, status: val as any } : inc));
                      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `Voice command: Incident status set to ${val}` } }));
                    }
                  }}
                  placeholder="Dictate notes or response..."
                />
              </div>
              
              <div className="relative">
                <textarea
                  value={responseDraft}
                  onChange={(e) => setResponseDraft(e.target.value)}
                  rows={6}
                  placeholder="Draft response details or incident findings..."
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/80 p-2.5 pr-10 font-sans text-xxs text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                
                {/* Voice Dictation Hands-Free Button */}
                <button
                  type="button"
                  onClick={startDictation}
                  title="Dictate findings hands-free (Speech-to-Text)"
                  className={`absolute right-2 top-2 p-1.5 rounded-lg border transition-all cursor-pointer ${
                    isDictating 
                      ? 'bg-rose-500/20 border-rose-500 text-rose-400' 
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/50'
                  }`}
                >
                  <Icons.Mic className={`h-3.5 w-3.5 ${isDictating ? 'animate-pulse text-rose-400' : ''}`} />
                </button>
              </div>

              <div className="mt-3 flex space-x-2">
                <button
                  onClick={handleSendAutomaticReply}
                  className="flex-1 py-2 bg-indigo-600 rounded-md text-white font-bold transition-colors hover:bg-indigo-500 flex items-center justify-center space-x-1.5 text-xxs cursor-pointer"
                >
                  <Icons.Send className="h-3.5 w-3.5" />
                  <span>Send & Close Incident</span>
                </button>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* BULK ACTION CONFIRMATION MODAL */}
      <AnimatePresence>
        {pendingBulkAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center space-x-2.5 text-amber-400">
                  <Icons.AlertTriangle className="h-5 w-5 animate-pulse" />
                  <h4 className="font-display font-bold text-sm text-white">Confirm Bulk Queue Update</h4>
                </div>
                <button
                  onClick={() => setPendingBulkAction(null)}
                  className="rounded-md border border-slate-800 bg-slate-950/80 p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <Icons.X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 font-sans">
                <p className="text-xxs text-slate-300 leading-relaxed">
                  You have requested a bulk change targeting <span className="text-indigo-400 font-bold font-mono">{pendingBulkAction.targetIds.length}</span> active operational tickets.
                </p>

                <div className="rounded-lg bg-slate-950 border border-slate-800/60 p-3.5 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Requested Change</span>
                    <span className="text-[9px] font-mono text-indigo-400 font-bold uppercase bg-indigo-500/5 px-1.5 py-0.5 rounded border border-indigo-500/10">
                      {pendingBulkAction.type}
                    </span>
                  </div>
                  
                  <div className="text-[11px] text-slate-200">
                    {pendingBulkAction.type === 'ASSIGN' && (
                      <span>Assigning <strong className="font-mono text-indigo-400">{pendingBulkAction.targetIds.length}</strong> incidents to <strong className="text-white">{pendingBulkAction.value}</strong>.</span>
                    )}
                    {pendingBulkAction.type === 'STATUS' && (
                      <span>Setting the status of <strong className="font-mono text-indigo-400">{pendingBulkAction.targetIds.length}</strong> incidents to <strong className="text-white uppercase">{pendingBulkAction.value}</strong>.</span>
                    )}
                    {pendingBulkAction.type === 'REPRIORITIZE' && (
                      <span>Updating severity priority to <strong className="text-white font-mono">{pendingBulkAction.value}</strong> (SLA limits and notifications will align immediately).</span>
                    )}
                    {pendingBulkAction.type === 'RESOLVE_ALL' && (
                      <span>Instantly resolving <strong className="font-mono text-indigo-400">{pendingBulkAction.targetIds.length}</strong> selected incidents with an automatic CSAT satisfaction score of <strong className="text-emerald-400 font-mono">94%</strong>.</span>
                    )}
                  </div>
                </div>

                <div className="rounded-lg bg-indigo-500/5 border border-indigo-500/15 p-3 flex gap-2.5 items-start">
                  <Icons.Info className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <h5 className="text-[10px] font-bold text-indigo-300 uppercase tracking-wide">Change Impact Summary</h5>
                    <p className="text-[9.5px] text-slate-400 leading-normal">
                      Assigning new owners or modifying live statuses fires automatic webhooks, alters support metrics SLAs, and routes client notifications. Proceed with care.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex space-x-2.5 justify-end">
                <button
                  onClick={() => setPendingBulkAction(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xxs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyBulkAction}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xxs font-bold transition-colors cursor-pointer shadow-lg shadow-indigo-600/10"
                >
                  Confirm & Apply Change
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REMEDIATION APPROVAL MODAL (CTO elektron signatures override) */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center space-x-2.5 border-b border-slate-800 pb-3 text-amber-400 mb-4">
              <Icons.ShieldAlert className="h-5 w-5 animate-pulse" />
              <h4 className="font-display font-bold text-sm text-white">Production Bypass Clearance</h4>
            </div>
            
            <p className="text-xxs text-slate-300 leading-relaxed mb-4">
              You are about to execute a remediation action with high potential impact:
              <span className="block mt-1 bg-slate-950 p-2 rounded font-mono text-[10px] text-emerald-300 select-all font-semibold">
                {pendingAction}
              </span>
            </p>

            <div className="space-y-3.5 font-sans">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Active Operator</label>
                <div className="rounded bg-slate-950 px-2.5 py-1.5 font-mono text-xxs text-slate-300">
                  Eshan Barua (CTO) | eshanbaruabarua@gmail.com
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Bypass Override Code</label>
                <div className="rounded bg-slate-950 px-2.5 py-1.5 font-mono text-xxs text-slate-500 select-none">
                  SYS_BYPASS_TOKEN_VERIFIED_7X82E
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Electronic Signature Verification</label>
                <input
                  type="text"
                  placeholder="Type 'Eshan Barua' to verify authority signature"
                  value={approvalSignature}
                  onChange={(e) => setApprovalSignature(e.target.value)}
                  className="w-full rounded border border-slate-800 bg-slate-950 p-2 font-mono text-xxs text-emerald-400 outline-none focus:border-indigo-500"
                />
                {approvalSignature && (
                  <div className="mt-2.5 p-3 rounded-lg bg-slate-950 border border-slate-800/40 text-center relative overflow-hidden">
                    <span className="absolute top-1 left-2 font-mono text-[8px] text-slate-600 tracking-wider">PREVIEW SECURE SIGNATURE</span>
                    <span className="font-signature text-3xl text-indigo-400 select-none animate-fadeIn block pt-2.5 pb-1">
                      {approvalSignature}
                    </span>
                    <div className="h-[1px] w-3/4 mx-auto bg-indigo-500/20 mt-1" />
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex space-x-2.5">
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setPendingAction(null);
                  setApprovalSignature('');
                }}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xxs font-bold transition-colors"
              >
                Cancel Dispatch
              </button>
              <button
                onClick={handleConfirmActionApproval}
                disabled={selectedIncident.severity === 'CRITICAL' && approvalSignature.trim() !== 'Eshan Barua'}
                className="flex-1 py-2 bg-emerald-600 disabled:opacity-40 hover:bg-emerald-500 text-white rounded text-xxs font-bold transition-colors"
              >
                Confirm Signature & Execute
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over telemetry drawer */}
      <IncidentDetailsDrawer
        incidentId={drawerIncidentId}
        incident={incidents.find(i => i.id === drawerIncidentId)}
        onClose={() => setDrawerIncidentId(null)}
        onAddAuditLog={onAddAuditLog}
      />

      {/* FLOATING BULK BATCH ACTIONS BAR */}
      <AnimatePresence>
        {bulkMode && selectedIncidentIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center space-x-3.5 rounded-xl border border-indigo-500/40 bg-slate-950/95 px-5 py-3.5 shadow-2xl shadow-black/80 backdrop-blur-xl"
          >
            <div className="flex items-center space-x-2 text-xxs font-mono text-indigo-400">
              <Icons.Inbox className="h-4 w-4 animate-bounce shrink-0" />
              <span className="font-bold uppercase tracking-wider whitespace-nowrap">{selectedIncidentIds.length} SELECTED</span>
            </div>

            <div className="h-5 w-[1px] bg-slate-800 shrink-0" />

            <div className="flex items-center space-x-2.5">
              {/* Batch Assignment Dropdown */}
              <div className="relative shrink-0">
                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    setPendingBulkAction({
                      type: 'ASSIGN',
                      value: val,
                      targetIds: [...selectedIncidentIds]
                    });
                    e.target.value = "";
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 text-[10px] py-1.5 px-2.5 appearance-none focus:outline-none focus:border-indigo-500 cursor-pointer transition-all pr-6"
                >
                  <option value="">Assign To...</option>
                  {ENGINEERS.map(eng => <option key={eng} value={eng}>{eng}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-500">
                  <Icons.ChevronDown className="h-3 w-3" />
                </div>
              </div>

              {/* Batch Status Dropdown */}
              <div className="relative shrink-0">
                <select
                  onChange={(e) => {
                    const val = e.target.value as any;
                    if (!val) return;
                    setPendingBulkAction({
                      type: 'STATUS',
                      value: val,
                      targetIds: [...selectedIncidentIds]
                    });
                    e.target.value = "";
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 text-[10px] py-1.5 px-2.5 appearance-none focus:outline-none focus:border-indigo-500 cursor-pointer transition-all pr-6"
                >
                  <option value="">Set Status...</option>
                  <option value="OPEN">OPEN</option>
                  <option value="INVESTIGATING">INVESTIGATING</option>
                  <option value="ESCALATED">ESCALATED</option>
                  <option value="SOLVED">SOLVED</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-500">
                  <Icons.ChevronDown className="h-3 w-3" />
                </div>
              </div>

              {/* Batch Re-prioritize Dropdown */}
              <div className="relative shrink-0">
                <select
                  onChange={(e) => {
                    const val = e.target.value as any;
                    if (!val) return;
                    setPendingBulkAction({
                      type: 'REPRIORITIZE',
                      value: val,
                      targetIds: [...selectedIncidentIds]
                    });
                    e.target.value = "";
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 text-[10px] py-1.5 px-2.5 appearance-none focus:outline-none focus:border-indigo-500 cursor-pointer transition-all pr-6"
                >
                  <option value="">Set Priority...</option>
                  <option value="CRITICAL">P0 (CRITICAL)</option>
                  <option value="HIGH">P1 (HIGH)</option>
                  <option value="MEDIUM">P2 (MEDIUM)</option>
                  <option value="LOW">P3 (LOW)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-500">
                  <Icons.ChevronDown className="h-3 w-3" />
                </div>
              </div>

              {/* Resolve All Quickly Button */}
              <button
                onClick={() => {
                  setPendingBulkAction({
                    type: 'RESOLVE_ALL',
                    value: 'SOLVED',
                    targetIds: [...selectedIncidentIds]
                  });
                }}
                className="flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xxs font-bold text-white hover:bg-emerald-500 cursor-pointer transition-all shadow-lg shadow-emerald-600/10 shrink-0"
              >
                <Icons.CheckCircle className="h-3.5 w-3.5" />
                <span>Quick Resolve</span>
              </button>

              {/* Download CSV Button */}
              <button
                onClick={handleDownloadCSV}
                className="flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xxs font-bold text-white hover:bg-indigo-500 cursor-pointer transition-all shadow-lg shadow-indigo-600/10 shrink-0"
                title="Download currently filtered incidents as a CSV report"
              >
                <Icons.Download className="h-3.5 w-3.5" />
                <span>Download CSV</span>
              </button>

              {/* Cancel Selection */}
              <button
                onClick={() => setSelectedIncidentIds([])}
                className="rounded-lg border border-slate-800 bg-slate-900/50 hover:bg-slate-800 hover:border-slate-700 px-2.5 py-1.5 text-xxs font-medium text-slate-400 hover:text-white cursor-pointer transition-all shrink-0"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SEVERITY LEGEND MODAL */}
      <AnimatePresence>
        {isSeverityLegendOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center space-x-2.5 text-indigo-400">
                  <Icons.HelpCircle className="h-5 w-5" />
                  <h4 className="font-display font-bold text-sm text-white">SLA Severity Levels & Escalation Rules</h4>
                </div>
                <button
                  onClick={() => setIsSeverityLegendOpen(false)}
                  className="rounded-md border border-slate-800 bg-slate-950/80 p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <Icons.X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xxs text-slate-400 leading-normal mb-4">
                Operations queue priorities dictate standard support SLA response timeframes, automated escalation actions, and customer notification behaviors.
              </p>

              <div className="space-y-3 font-sans max-h-[40vh] overflow-y-auto pr-1">
                {/* P0 */}
                <div className="rounded-lg bg-rose-500/5 border border-rose-500/20 p-3 flex gap-3 items-start">
                  <span className="rounded bg-rose-500 text-slate-950 px-2 py-0.5 font-mono text-[9px] font-black shrink-0">P0</span>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <h5 className="text-[11px] font-bold text-rose-400 uppercase tracking-wide">CRITICAL OUTAGE</h5>
                      <span className="font-mono text-[9px] font-bold text-rose-500">SLA: 15 Mins</span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-relaxed">
                      Complete service failure, security exploit, or database core isolation. Triggers immediate PagerDuty SMS to CTO/On-Call, and hourly executive status briefs.
                    </p>
                  </div>
                </div>

                {/* P1 */}
                <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 flex gap-3 items-start">
                  <span className="rounded bg-amber-500 text-slate-950 px-2 py-0.5 font-mono text-[9px] font-black shrink-0">P1</span>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <h5 className="text-[11px] font-bold text-amber-400 uppercase tracking-wide">HIGH DEGRADATION</h5>
                      <span className="font-mono text-[9px] font-bold text-amber-500">SLA: 60 Mins</span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-relaxed">
                      Core feature failures (e.g., checkout server down, stripe webhooks blocked) affecting a group of active tenant users. Notifies lead operations engineer.
                    </p>
                  </div>
                </div>

                {/* P2 */}
                <div className="rounded-lg bg-indigo-500/5 border border-indigo-500/20 p-3 flex gap-3 items-start">
                  <span className="rounded bg-indigo-500 text-slate-950 px-2 py-0.5 font-mono text-[9px] font-black shrink-0">P2</span>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <h5 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wide">MEDIUM WARNING</h5>
                      <span className="font-mono text-[9px] font-bold text-indigo-500">SLA: 4 Hours</span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-relaxed">
                      Non-blocking software warning (e.g., memory leak alerts, sluggish trace timings). Routed to normal sprint planning queue.
                    </p>
                  </div>
                </div>

                {/* P3 */}
                <div className="rounded-lg bg-slate-800/20 border border-slate-800 p-3 flex gap-3 items-start">
                  <span className="rounded bg-slate-800 text-slate-300 px-2 py-0.5 font-mono text-[9px] font-black shrink-0">P3</span>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">LOW COSMETIC</h5>
                      <span className="font-mono text-[9px] font-bold text-slate-400">SLA: 12 Hours</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Cosmetic, typing errors, minor frontend UI flaws. Handled within normal developer release cycles.
                    </p>
                  </div>
                </div>
              </div>

              {/* Stacked Bar Chart */}
              <div className="mt-5 pt-4 border-t border-slate-800">
                {/* Statistics Summary */}
                <div className="mb-4 rounded-xl bg-slate-950/50 border border-slate-800/60 p-3 grid grid-cols-5 gap-2 font-sans">
                  <div className="bg-slate-900/40 rounded-lg p-1.5 border border-slate-800/40 text-center">
                    <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Total Cases</div>
                    <div className="text-xs font-bold text-white font-mono">{totalPeriodIncidents}</div>
                  </div>
                  <div className="bg-rose-500/5 rounded-lg p-1.5 border border-rose-500/10 text-center">
                    <div className="text-[8px] text-rose-400 font-bold uppercase tracking-wider mb-0.5">P0 (Crit)</div>
                    <div className="text-[10px] font-bold text-rose-500 font-mono flex flex-col items-center">
                      <span>{sumP0}</span>
                      <span className="text-[8px] text-slate-400 font-normal">({pctP0}%)</span>
                    </div>
                  </div>
                  <div className="bg-amber-500/5 rounded-lg p-1.5 border border-amber-500/10 text-center">
                    <div className="text-[8px] text-amber-400 font-bold uppercase tracking-wider mb-0.5">P1 (High)</div>
                    <div className="text-[10px] font-bold text-amber-500 font-mono flex flex-col items-center">
                      <span>{sumP1}</span>
                      <span className="text-[8px] text-slate-400 font-normal">({pctP1}%)</span>
                    </div>
                  </div>
                  <div className="bg-indigo-500/5 rounded-lg p-1.5 border border-indigo-500/10 text-center">
                    <div className="text-[8px] text-indigo-400 font-bold uppercase tracking-wider mb-0.5">P2 (Med)</div>
                    <div className="text-[10px] font-bold text-indigo-500 font-mono flex flex-col items-center">
                      <span>{sumP2}</span>
                      <span className="text-[8px] text-slate-400 font-normal">({pctP2}%)</span>
                    </div>
                  </div>
                  <div className="bg-slate-800/20 rounded-lg p-1.5 border border-slate-800/40 text-center">
                    <div className="text-[8px] text-slate-300 font-bold uppercase tracking-wider mb-0.5">P3 (Low)</div>
                    <div className="text-[10px] font-bold text-slate-400 font-mono flex flex-col items-center">
                      <span>{sumP3}</span>
                      <span className="text-[8px] text-slate-400 font-normal">({pctP3}%)</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-display font-bold text-[11px] text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <Icons.BarChart3 className="h-3.5 w-3.5 animate-pulse" />
                    <span>Incident Severity Trend Analysis</span>
                  </h5>
                  
                  {/* Date Range Selection Dropdown */}
                  <div className="relative">
                    <select
                      id="legend-time-period"
                      value={legendTimePeriod}
                      onChange={(e) => setLegendTimePeriod(e.target.value as any)}
                      className="rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300 py-1 pl-2 pr-6 appearance-none focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="7days">Last 7 days</option>
                      <option value="30days">Last 30 days</option>
                      <option value="ytd">Year to date</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-500">
                      <Icons.ChevronDown className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>

                {/* Advanced Controls */}
                <div className="mb-3 flex items-center justify-between gap-3 text-[10px] font-sans">
                  {/* Auto-refresh */}
                  <label className="flex items-center space-x-1.5 text-slate-300 select-none cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isAutoRefreshActive}
                      onChange={(e) => setIsAutoRefreshActive(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0 h-3 w-3 cursor-pointer"
                    />
                    <span className="flex items-center gap-1">
                      <Icons.RefreshCw className={`h-3 w-3 text-indigo-400 ${isAutoRefreshActive ? 'animate-spin' : ''}`} />
                      <span>Auto-Refresh (5m)</span>
                    </span>
                  </label>

                  {/* Compare previous */}
                  <label className="flex items-center space-x-1.5 text-slate-300 select-none cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={comparePrevious}
                      onChange={(e) => setComparePrevious(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-emerald-600 focus:ring-0 focus:ring-offset-0 h-3 w-3 cursor-pointer"
                    />
                    <span className="flex items-center gap-1">
                      <Icons.Layers className="h-3 w-3 text-emerald-400" />
                      <span>Compare Previous Period</span>
                    </span>
                  </label>
                </div>

                {/* Stacked Bar Chart with Container ID for Download */}
                <div id="severity-legend-chart-container" className="h-56 w-full bg-slate-950/40 rounded-xl p-2 border border-slate-800/60 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={preparedChartData}
                      margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis 
                        dataKey="name" 
                        stroke="#64748b" 
                        fontSize={9} 
                        tickLine={false} 
                      />
                      <YAxis 
                        stroke="#64748b" 
                        fontSize={9} 
                        tickLine={false} 
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#020617',
                          borderColor: '#1e293b',
                          borderRadius: '8px',
                          fontSize: '9px',
                          fontFamily: 'monospace'
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ fontSize: '8px', fontFamily: 'monospace', marginTop: '3px' }}
                        verticalAlign="bottom"
                        height={12}
                      />
                      <Bar 
                        dataKey="P0" 
                        stackId="a" 
                        fill="#f43f5e" 
                        name="P0 (Critical)" 
                        cursor="pointer" 
                        onClick={(data) => handleSegmentClick('P0', data)} 
                      />
                      <Bar 
                        dataKey="P1" 
                        stackId="a" 
                        fill="#f59e0b" 
                        name="P1 (High)" 
                        cursor="pointer" 
                        onClick={(data) => handleSegmentClick('P1', data)} 
                      />
                      <Bar 
                        dataKey="P2" 
                        stackId="a" 
                        fill="#6366f1" 
                        name="P2 (Medium)" 
                        cursor="pointer" 
                        onClick={(data) => handleSegmentClick('P2', data)} 
                      />
                      <Bar 
                        dataKey="P3" 
                        stackId="a" 
                        fill="#64748b" 
                        name="P3 (Low)" 
                        radius={[2, 2, 0, 0]} 
                        cursor="pointer" 
                        onClick={(data) => handleSegmentClick('P3', data)} 
                      />
                      {comparePrevious && (
                        <Bar 
                          dataKey="previousTotal" 
                          fill="#3b82f6" 
                          name="Prev Period Total" 
                          opacity={0.35} 
                          radius={[2, 2, 0, 0]} 
                        />
                      )}
                      <Line 
                        type="monotone" 
                        dataKey="movingAverage" 
                        stroke="#10b981" 
                        strokeWidth={2} 
                        dot={{ r: 1.5 }} 
                        activeDot={{ r: 3 }} 
                        name="7d Moving Avg" 
                      />
                      <Brush 
                        dataKey="name" 
                        height={15} 
                        stroke="#334155" 
                        fill="#0f172a" 
                        startIndex={0} 
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Export Toolbar */}
                <div className="mt-2 flex justify-end gap-1.5 text-[9px] font-mono text-slate-400">
                  <span className="self-center mr-1">Export Chart:</span>
                  <button
                    onClick={() => handleDownloadChart('png')}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:text-white hover:border-slate-700 cursor-pointer transition-colors"
                  >
                    <Icons.Download className="h-3 w-3 text-indigo-400" />
                    <span>PNG</span>
                  </button>
                  <button
                    onClick={() => handleDownloadChart('svg')}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:text-white hover:border-slate-700 cursor-pointer transition-colors"
                  >
                    <Icons.Download className="h-3 w-3 text-emerald-400" />
                    <span>SVG</span>
                  </button>
                </div>
              </div>

              <div className="mt-5 text-right">
                <button
                  onClick={() => setIsSeverityLegendOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xxs font-bold transition-colors cursor-pointer"
                >
                  Dismiss Legend
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FLOATING QUICK SCRATCHPAD TRIGGER BUTTON */}
      <div className="fixed bottom-5 right-5 z-40">
        <button
          onClick={() => setIsScratchpadOpen(true)}
          className="h-12 w-12 rounded-full bg-indigo-600 hover:bg-indigo-500 hover:scale-105 active:scale-95 text-white flex items-center justify-center shadow-2xl border border-indigo-400/40 cursor-pointer transition-all relative group"
          title="Open Quick Investigations Scratchpad (Ctrl+S)"
        >
          <Icons.FileEdit className="h-5.5 w-5.5 text-white" />
          {scratchpadText.trim() && (
            <span className="absolute top-0.5 right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-slate-950 animate-pulse" />
          )}
          
          {/* Tooltip */}
          <div className="absolute right-14 bg-slate-950 border border-slate-800 text-[9px] font-mono font-bold text-slate-300 px-2 py-1 rounded shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            INVESTIGATIVE SCRATCHPAD (Ctrl+S)
          </div>
        </button>
      </div>

      {/* FLOATING GLASSMORPHIC SCRATCHPAD DRAWER */}
      <AnimatePresence>
        {isScratchpadOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsScratchpadOpen(false)}
              className="fixed inset-0 bg-slate-950 z-40 cursor-pointer"
            />

            {/* Sliding Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-[400px] bg-slate-950/95 border-l border-slate-800/80 shadow-2xl z-50 flex flex-col backdrop-blur-md p-5 font-mono text-xxs text-slate-300"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-3 mb-4">
                <div className="flex items-center space-x-2">
                  <Icons.FileEdit className="h-4.5 w-4.5 text-indigo-400" />
                  <span className="font-display font-bold text-sm text-white uppercase tracking-wider">Quick Scratchpad</span>
                </div>
                <button
                  onClick={() => setIsScratchpadOpen(false)}
                  className="rounded-lg p-1 text-slate-500 hover:text-white hover:bg-slate-900 transition-all cursor-pointer"
                  title="Close scratchpad"
                >
                  <Icons.X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Description */}
              <div className="mb-3.5 leading-relaxed text-[9px] text-slate-400 bg-slate-900/40 rounded-lg p-2.5 border border-slate-900">
                ✏️ Ephemeral workspace for investigation logs, query fragments, or findings. Automatically saved locally. Keep notes during active investigation.
              </div>

              {/* Text Area */}
              <div className="flex-1 flex flex-col min-h-0 mb-4">
                <textarea
                  value={scratchpadText}
                  onChange={(e) => handleUpdateScratchpad(e.target.value)}
                  placeholder="Paste logs, track suspect microservices, jot down SQL queries, or draft immediate runbook findings here..."
                  className="flex-1 w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-[10px] font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 resize-none leading-relaxed"
                />
              </div>

              {/* Quick Action Helpers */}
              <div className="mb-4">
                <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 pl-1">Insert Diagnostic Snippets</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => {
                      const snippet = `\n--- Suspect Root Cause Analysis ---\nSUSPECT NODE: \nROOT CAUSE HYPOTHESIS: \nACTION TAKEN: \nTIME LOGGED: ${new Date().toISOString()}\n`;
                      handleUpdateScratchpad(scratchpadText + snippet);
                    }}
                    className="py-1 px-2 rounded bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[8px] text-indigo-400 font-bold transition-all text-left truncate cursor-pointer"
                  >
                    + Root Cause Template
                  </button>
                  <button
                    onClick={() => {
                      const snippet = `\n--- Database Investigation ---\nSuspect Row Lock: \nActive Connection Count: \nSlow Queries Analyzed: \n`;
                      handleUpdateScratchpad(scratchpadText + snippet);
                    }}
                    className="py-1 px-2 rounded bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[8px] text-emerald-400 font-bold transition-all text-left truncate cursor-pointer"
                  >
                    + DB Investigation Template
                  </button>
                  <button
                    onClick={() => {
                      const snippet = `\n--- Live Command Execution logs ---\nCWD: /opt/pilot\nCOMMANDS RUN:\n- kubectl logs -l app=billing-core --tail=100\n- kubectl get pods -n prod\n`;
                      handleUpdateScratchpad(scratchpadText + snippet);
                    }}
                    className="py-1 px-2 rounded bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[8px] text-amber-400 font-bold transition-all text-left truncate cursor-pointer"
                  >
                    + Live Commands Log
                  </button>
                  <button
                    onClick={() => {
                      const snippet = `\n--- NOC Escalation Request ---\nURGENCY: P0\nREQUIRED ACTION: \nCONTACT: alex.rivera@pilot.noc\n`;
                      handleUpdateScratchpad(scratchpadText + snippet);
                    }}
                    className="py-1 px-2 rounded bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[8px] text-rose-400 font-bold transition-all text-left truncate cursor-pointer"
                  >
                    + NOC Escalation Request
                  </button>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="border-t border-slate-900/60 pt-3 flex space-x-2 shrink-0">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(scratchpadText);
                    window.dispatchEvent(new CustomEvent('show-toast', {
                      detail: { message: 'Scratchpad notes copied to clipboard.' }
                    }));
                  }}
                  disabled={!scratchpadText.trim()}
                  className="flex-1 flex items-center justify-center space-x-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold disabled:opacity-45 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <Icons.Copy className="h-3.5 w-3.5" />
                  <span>COPY NOTES</span>
                </button>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to clear your ephemeral investigation findings? This action is irreversible.')) {
                      handleUpdateScratchpad('');
                    }
                  }}
                  disabled={!scratchpadText.trim()}
                  className="py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-rose-400 hover:text-rose-300 font-bold disabled:opacity-45 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="Clear Scratchpad"
                >
                  <Icons.Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Voice Command History Drawer */}
      <VoiceCommandHistoryPanel onReplayCommand={(cmdName, param) => {
        if (cmdName === 'SET_STATUS' && param) {
          setIncidents(prev => prev.map(inc => inc.id === selectedIncident.id ? { ...inc, status: param as any } : inc));
        }
      }} />

      {/* QUICK RESOLUTION WIZARD MODAL */}
      <AnimatePresence>
        {isQuickResolutionOpen && resolutionIncidentTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl font-sans text-slate-100 relative overflow-hidden"
            >
              {/* Top Accent line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-indigo-500 to-amber-500" />

              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    <Icons.CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>Quick Resolution & Archival Wizard</span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-indigo-400 font-semibold">
                        {resolutionIncidentTarget.id}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">Record standardized root-cause summary and resolution code before archiving.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsQuickResolutionOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <Icons.X className="h-4 w-4" />
                </button>
              </div>

              <div className="py-4 space-y-4 text-xs">
                {/* Incident Title Banner */}
                <div className="rounded-xl bg-slate-950 p-3 border border-slate-800/80 font-mono">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Target Incident</div>
                  <div className="text-sm font-bold text-white leading-snug">{resolutionIncidentTarget.title}</div>
                  <div className="mt-1 flex items-center space-x-3 text-slate-400 text-[10px]">
                    <span>App: <strong className="text-indigo-400">{resolutionIncidentTarget.appName}</strong></span>
                    <span>Severity: <strong className="text-rose-400">{resolutionIncidentTarget.severity}</strong></span>
                    <span>Current Status: <strong className="text-amber-400">{resolutionIncidentTarget.status}</strong></span>
                  </div>
                </div>

                {/* Resolution Code Dropdown */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center justify-between">
                    <span>1. Resolution Code & Categorization *</span>
                    <span className="text-[10px] text-indigo-400 font-normal">Standardized Reporting Schema</span>
                  </label>
                  <select
                    value={resolutionCode}
                    onChange={(e) => setResolutionCode(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 font-mono text-xs text-indigo-300 outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {RESOLUTION_CODES.map(rc => (
                      <option key={rc.code} value={rc.code}>
                        {rc.code} — {rc.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 font-mono italic">
                    {RESOLUTION_CODES.find(rc => rc.code === resolutionCode)?.desc}
                  </p>
                </div>

                {/* Root Cause Summary Textarea */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                      2. Root-Cause Summary *
                    </label>
                    <button
                      type="button"
                      onClick={() => setResolutionRootCause(resolutionIncidentTarget.analysis?.rootCause || 'Root cause identified and remediated.')}
                      className="text-[10px] font-mono text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Icons.Sparkles className="h-3 w-3" />
                      <span>Pre-fill AI Diagnosis</span>
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Provide a concise, factual summary of the root cause identified (e.g. PostgreSQL connection pool lock exhaustion on table 'orders')..."
                    value={resolutionRootCause}
                    onChange={(e) => setResolutionRootCause(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500 font-sans leading-relaxed"
                  />
                </div>

                {/* Optional Resolution Notes / Preventive Actions */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                    3. Preventive Action & Patch Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Scaled pool to 100 max_connections and added missing composite index on orders(tenant_id, created_at)"
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500 font-sans"
                  />
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <div className="text-[10px] font-mono text-slate-500 flex items-center space-x-1">
                  <Icons.ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Audit Trail user: <strong>{LOGGED_IN_USER}</strong></span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsQuickResolutionOpen(false)}
                    className="rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800 px-4 py-2 font-mono text-xs font-bold text-slate-300 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmResolution}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 px-5 py-2 font-mono text-xs font-bold text-white transition-all shadow-lg shadow-emerald-600/30 flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Icons.CheckCircle2 className="h-4 w-4" />
                    <span>Archive Incident</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
    </div>
  );
}

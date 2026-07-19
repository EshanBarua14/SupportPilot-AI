import React, { useState, useEffect, useRef } from 'react';
import { Incident, LogEntry, TimelineEvent, Tenant } from '../types';
import { InitialIncidents, SeedTenants } from '../data/simulation';
import * as Icons from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import IncidentDetailsDrawer from './IncidentDetailsDrawer';
import IncidentDependencyGraph from './IncidentDependencyGraph';
import { jsPDF } from 'jspdf';

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

function highlightLogMessage(message: string): React.ReactNode {
  // Regex capturing key error/telemetry patterns
  const regex = /\b(CRITICAL|FATAL|Timeout|ERROR|Failed|Exception|WARN|WARNING|SUCCESS|OK)\b/gi;
  const parts = message.split(regex);
  if (parts.length === 1) return <span>{message}</span>;

  return (
    <span>
      {parts.map((part, index) => {
        const lower = part.toLowerCase();
        if (lower === 'critical' || lower === 'fatal') {
          return (
            <span key={index} className="text-rose-400 font-extrabold bg-rose-950/40 px-1 rounded border border-rose-500/20">
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
        if (lower === 'timeout' || lower === 'warn' || lower === 'warning') {
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

  const [quickNote, setQuickNote] = useState('');
  
  const [pendingBulkAction, setPendingBulkAction] = useState<{
    type: 'ASSIGN' | 'STATUS' | 'REPRIORITIZE' | 'RESOLVE_ALL';
    value: string;
    targetIds: string[];
  } | null>(null);
  
  const currentChartData = legendTrendData[legendTimePeriod];
  const sumP0 = currentChartData.reduce((acc, curr) => acc + curr.P0, 0);
  const sumP1 = currentChartData.reduce((acc, curr) => acc + curr.P1, 0);
  const sumP2 = currentChartData.reduce((acc, curr) => acc + curr.P2, 0);
  const sumP3 = currentChartData.reduce((acc, curr) => acc + curr.P3, 0);
  const totalPeriodIncidents = sumP0 + sumP1 + sumP2 + sumP3;

  const pctP0 = totalPeriodIncidents > 0 ? Math.round((sumP0 / totalPeriodIncidents) * 100) : 0;
  const pctP1 = totalPeriodIncidents > 0 ? Math.round((sumP1 / totalPeriodIncidents) * 100) : 0;
  const pctP2 = totalPeriodIncidents > 0 ? Math.round((sumP2 / totalPeriodIncidents) * 100) : 0;
  const pctP3 = totalPeriodIncidents > 0 ? 100 - (pctP0 + pctP1 + pctP2) : 0;

  const filteredIncidents = incidents
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
    });

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
            return { ...inc, assignee: value, lastModifiedBy: "Eshan Barua (CTO)" };
          case 'STATUS':
            return { ...inc, status: value as any, lastModifiedBy: "Eshan Barua (CTO)" };
          case 'REPRIORITIZE':
            return { ...inc, severity: value as any, lastModifiedBy: "Eshan Barua (CTO)" };
          case 'RESOLVE_ALL':
            return { ...inc, status: 'SOLVED', csatScore: 94, lastModifiedBy: "Eshan Barua (CTO)" };
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
    
    const noteText = quickNote.trim();
    
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
    
    setQuickNote('');
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message: "Note appended to incident summary and timeline!" }
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
  const [telemetryTab, setTelemetryTab] = useState<'logs' | 'metrics' | 'traces' | 'db' | 'k8s' | 'topology' | 'timeline'>('logs');

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
            lastModifiedBy: "AI Investigator"
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
            lastModifiedBy: "AutomationAgent"
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
    doc.save(`SupportPilot_Debrief_Incident_${selectedIncident.id}.pdf`);

    onAddAuditLog(
      "Eshan Barua (CTO)",
      "Document Generated",
      "Compliance Engine",
      "SUCCESS",
      `Compiled visual operational debrief report PDF for incident: ${selectedIncident.id}.`
    );
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
    <div className="grid h-[calc(100vh-130px)] grid-cols-12 gap-4 text-xs font-sans">
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
            onClick={() => setPriorityOnly(!priorityOnly)}
            className={`flex-1 flex items-center justify-center space-x-1.5 rounded-lg py-1.5 px-2 border transition-all cursor-pointer ${
              priorityOnly
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-400 font-bold'
                : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:text-white hover:border-slate-800'
            }`}
            title="Toggle High Priority Only (Alt+P)"
          >
            <Icons.AlertOctagon className="h-3.5 w-3.5" />
            <span className="text-[10px]">Priority</span>
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

        {/* Active Filters Pill */}
        {(severityFilter !== 'ALL' || timePeriodFilter !== 'ALL' || priorityOnly) && (
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
          <AnimatePresence mode="popLayout">
            {filteredIncidents
              .map((inc) => {
                const isSelected = inc.id === selectedIncident.id;
                const isSolved = inc.status === 'SOLVED';
                const isSelectedInBulk = selectedIncidentIds.includes(inc.id);

                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
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
                    className={`w-full flex items-center rounded-xl p-3 border.5 text-left transition-all relative overflow-hidden cursor-pointer ${
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
                      <div className="pl-1.5 mr-2 shrink-0 flex items-center justify-center">
                        <div className={`h-4 w-4 rounded border flex items-center justify-center transition-all ${
                          isSelectedInBulk
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'border-slate-700 bg-slate-950/80 hover:border-slate-500'
                        }`}>
                          {isSelectedInBulk && <Icons.Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                      </div>
                    )}

                    <div className="pl-1.5 space-y-2 w-full flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[9px] text-slate-500 font-semibold">{inc.id}</span>
                        <div className="relative group/sev-tooltip shrink-0">
                          <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold ${getSeverityBadge(inc.severity)} cursor-help`}>
                            {inc.severity}
                          </span>
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

                      <div className="flex items-center justify-between border-t border-slate-800/40 pt-2 text-[10px]">
                        <div className="flex items-center space-x-1 text-slate-400 font-medium">
                          {getChannelIcon(inc.source)}
                          <span className="font-mono text-[9.5px]">{inc.appName}</span>
                        </div>
                        
                        {/* SLA countdown timer */}
                        {(() => {
                          const slaDetails = getSlaDetails(inc);
                          const radius = 6;
                          const circumference = 2 * Math.PI * radius;
                          const strokeDashoffset = circumference - (slaDetails.percentage / 100) * circumference;
                          
                          return (
                            <div className={`font-mono font-bold text-[9.5px] flex items-center space-x-1.5 ${
                              isSolved 
                                ? 'text-emerald-400' 
                                : slaDetails.isBreached 
                                  ? 'text-rose-400 animate-pulse' 
                                  : slaDetails.remainingMs < 10 * 60 * 1000 
                                    ? 'text-amber-400 animate-pulse' 
                                    : 'text-indigo-400'
                            }`}>
                              {isSolved ? (
                                <span className="flex items-center space-x-1">
                                  <Icons.Check className="h-3 w-3" />
                                  <span>CSAT {inc.csatScore}%</span>
                                </span>
                              ) : (
                                <div className="flex items-center space-x-1.5" title={`SLA Health: ${Math.round(slaDetails.percentage)}% time remaining`}>
                                  <svg className="h-3.5 w-3.5 transform -rotate-90 shrink-0" viewBox="0 0 16 16">
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
                                        slaDetails.isBreached 
                                          ? "stroke-rose-500" 
                                          : slaDetails.remainingMs < 10 * 60 * 1000 
                                            ? "stroke-amber-500" 
                                            : "stroke-indigo-500"
                                      }
                                      strokeWidth="1.5"
                                      fill="transparent"
                                      strokeDasharray={circumference}
                                      strokeDashoffset={strokeDashoffset}
                                      strokeLinecap="round"
                                    />
                                  </svg>
                                  <span>{slaDetails.formatted}</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
          </AnimatePresence>
        </div>
      </div>

      {/* 2. DYNAMIC WORKSPACE (Tabs + Telemetry Core Middle) */}
      <div className="col-span-5 flex flex-col overflow-hidden bento-card-premium">
        
        {/* Active Ticket Heading Details banner */}
        <div className="border-b border-slate-800/40 bg-slate-950/20 p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2 text-[9.5px] font-mono text-slate-500 mb-1.5">
                <div className="flex items-center space-x-1 border border-slate-800 bg-slate-900/60 rounded px-1.5 py-0.5 text-slate-400 hover:text-white transition-colors">
                  <span className="font-semibold text-slate-300">{selectedIncident.id}</span>
                  <button
                    id="btn-copy-incident-id"
                    onClick={handleCopyId}
                    className="p-0.5 hover:bg-slate-800 rounded transition-all cursor-pointer focus:outline-none flex items-center justify-center w-4 h-4 overflow-hidden relative"
                    title="Copy Incident ID"
                  >
                    <AnimatePresence mode="wait">
                      {copiedId ? (
                        <motion.span
                          key="check"
                          initial={{ scale: 0.3, opacity: 0, rotate: -20 }}
                          animate={{ scale: 1, opacity: 1, rotate: 0 }}
                          exit={{ scale: 0.3, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          className="text-emerald-400 flex items-center justify-center"
                        >
                          <Icons.Check className="h-2.5 w-2.5 text-emerald-400" />
                        </motion.span>
                      ) : (
                        <motion.span
                          key="copy"
                          initial={{ scale: 0.3, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.3, opacity: 0 }}
                          transition={{ duration: 0.1 }}
                          className="text-slate-400 flex items-center justify-center"
                        >
                          <Icons.Copy className="h-2.5 w-2.5" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                </div>

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
        </div>

        {/* Telemetry Tabs Selector */}
        <div className="flex items-center space-x-1 border-b border-slate-800/40 bg-slate-950/10 px-3 pt-2">
          {[
            { id: 'logs', label: 'Logs Stream', icon: Icons.FileText },
            { id: 'metrics', label: 'Metrics', icon: Icons.TrendingUp },
            { id: 'traces', label: 'Distributed Tracing', icon: Icons.GitFork },
            { id: 'db', label: 'Database', icon: Icons.Database },
            { id: 'k8s', label: 'ArgoCD / K8s', icon: Icons.Network },
            { id: 'topology', label: 'Topology Map', icon: Icons.Activity },
            { id: 'timeline', label: 'Investigation Timeline', icon: Icons.History }
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

              <div ref={logContainerRef} className="rounded-lg border border-slate-900 bg-slate-950/80 p-3 font-mono text-[10px] leading-relaxed space-y-1.5 max-h-[220px] overflow-y-auto select-text">
                {filteredLogs.map((line, i) => {
                  const isErr = line.level === 'FATAL' || line.level === 'ERROR';
                  const isWarn = line.level === 'WARN';
                  
                  const lowercaseMsg = line.message.toLowerCase();
                  const containsCritical = lowercaseMsg.includes('critical') || 
                                           lowercaseMsg.includes('fatal') || 
                                           lowercaseMsg.includes('timeout') || 
                                           lowercaseMsg.includes('exception') || 
                                           isErr;

                  const logLineContent = (
                    <div className="flex items-start space-x-2 w-full">
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
                      <span className={isErr ? 'text-rose-300 font-semibold' : 'text-slate-300'}>
                        {highlightLogMessage(line.message)}
                      </span>
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
              <div className="flex items-center justify-between text-xxs font-mono text-slate-500 border-b border-slate-800/50 pb-2">
                <span>Infrastructure Service Relationship Dependency Map</span>
                <span className="text-indigo-400 font-bold flex items-center space-x-1 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                  <span>Interactive Physics Canvas</span>
                </span>
              </div>
              <IncidentDependencyGraph selectedIncident={selectedIncident} />
            </div>
          )}

          {/* TAB 7: CHRONOLOGICAL INVESTIGATION TIMELINE */}
          {telemetryTab === 'timeline' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/50 pb-3">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                    <Icons.History className="h-4 w-4 text-indigo-400" />
                    <span>Comprehensive Investigation Chronology</span>
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

                {/* Stacked Bar Chart with Container ID for Download */}
                <div id="severity-legend-chart-container" className="h-44 w-full bg-slate-950/40 rounded-xl p-2 border border-slate-800/60 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={currentChartData}
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
                    </BarChart>
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

    </div>
  );
}

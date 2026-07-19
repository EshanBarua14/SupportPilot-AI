import React from 'react';
import { SimulatedMetricsDashboard } from '../data/simulation';
import * as Icons from 'lucide-react';
import { jsPDF } from 'jspdf';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line
} from 'recharts';

const liveIncidentVelocityData = [
  { interval: '02:00', critical: 1, high: 3, medium: 5 },
  { interval: '06:00', critical: 2, high: 4, medium: 9 },
  { interval: '10:00', critical: 5, high: 7, medium: 14 },
  { interval: '14:00', critical: 3, high: 8, medium: 11 },
  { interval: '18:00', critical: 6, high: 9, medium: 16 },
  { interval: '22:00', critical: 2, high: 6, medium: 12 },
  { interval: '02:00', critical: 1, high: 3, medium: 7 }
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/95 p-3 font-mono text-[10px] shadow-2xl backdrop-blur-md">
        <p className="font-bold text-white mb-2 border-b border-slate-900 pb-1.5 flex items-center justify-between">
          <span>Interval End:</span>
          <span className="text-indigo-400">{label}</span>
        </p>
        <div className="space-y-1.5">
          {payload.map((entry: any) => (
            <div key={entry.name} className="flex items-center justify-between space-x-6">
              <span className="flex items-center space-x-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: entry.stroke || entry.color }} />
                <span className="text-slate-400 capitalize">{entry.name}:</span>
              </span>
              <span className="font-bold text-white text-right">{entry.value} inc/hr</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const forecastData = [
  { hour: '+0h (Now)', predicted: 4.0, upperConfidence: 4.5, lowerConfidence: 3.5 },
  { hour: '+4h', predicted: 6.2, upperConfidence: 7.8, lowerConfidence: 4.6 },
  { hour: '+8h', predicted: 9.5, upperConfidence: 11.4, lowerConfidence: 7.6 },
  { hour: '+12h', predicted: 15.8, upperConfidence: 18.2, lowerConfidence: 13.4 },
  { hour: '+16h', predicted: 12.1, upperConfidence: 14.5, lowerConfidence: 9.7 },
  { hour: '+20h', predicted: 7.4, upperConfidence: 9.5, lowerConfidence: 5.3 },
  { hour: '+24h', predicted: 5.1, upperConfidence: 6.8, lowerConfidence: 3.4 }
];

const mttrData30Days = [
  { day: 'Day 1', mttr: 42 },
  { day: 'Day 4', mttr: 38 },
  { day: 'Day 7', mttr: 45 },
  { day: 'Day 10', mttr: 35 },
  { day: 'Day 13', mttr: 29 },
  { day: 'Day 16', mttr: 31 },
  { day: 'Day 19', mttr: 24 },
  { day: 'Day 22', mttr: 18 },
  { day: 'Day 25', mttr: 15 },
  { day: 'Day 28', mttr: 14 },
  { day: 'Day 30', mttr: 11 },
];

const apiEndpoints = [
  { path: 'POST /api/v2/auth/login', service: 'AuthService' },
  { path: 'GET /api/v2/incidents/query', service: 'IncidentService' },
  { path: 'POST /api/v2/runbooks/execute', service: 'RunbookEngine' },
  { path: 'GET /api/v2/telemetry/live', service: 'SignalRHub' },
  { path: 'PUT /api/v2/cluster/freeze', service: 'InterlockCore' },
  { path: 'POST /api/v2/notifications/dispatch', service: 'NotificationBroker' }
];

const timeSlots = ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];

interface HeatmapCell {
  endpointIndex: number;
  timeSlotIndex: number;
  latency: number;
  failureRate: number;
}

const generateInitialHeatmapData = (): HeatmapCell[] => {
  const cells: HeatmapCell[] = [];
  apiEndpoints.forEach((ep, epIdx) => {
    timeSlots.forEach((slot, tIdx) => {
      // Base values
      let latency = 50 + Math.random() * 80;
      let failureRate = +(Math.random() * 0.4).toFixed(2);

      if (ep.path.includes('query')) {
        latency = 220 + Math.random() * 120;
      } else if (ep.path.includes('execute')) {
        latency = 650 + Math.random() * 300;
        failureRate = +(Math.random() * 2.5).toFixed(2);
      } else if (ep.path.includes('freeze')) {
        latency = 1100 + Math.random() * 400;
        failureRate = +(Math.random() * 6.0).toFixed(2);
      }

      // Time peaks (10:00 and 18:00)
      if (tIdx === 5 || tIdx === 9) {
        latency *= 1.8;
        failureRate += 1.5;
      }

      cells.push({
        endpointIndex: epIdx,
        timeSlotIndex: tIdx,
        latency: Math.round(latency),
        failureRate: +failureRate.toFixed(2)
      });
    });
  });
  return cells;
};

export default function MetricsDashboard() {
  const data = SimulatedMetricsDashboard;
  const [timeRange, setTimeRange] = React.useState('Last 7 Days');

  // Dynamic Polling & Live Data state
  const [isLiveActive, setIsLiveActive] = React.useState(false);
  const [secondsToNextPoll, setSecondsToNextPoll] = React.useState(30);
  const [dynamicSlas, setDynamicSlas] = React.useState(data.activeSlas);
  const [dynamicCsat, setDynamicCsat] = React.useState(data.csat);
  const [dynamicCpu, setDynamicCpu] = React.useState(data.cpuUtilization);
  const [dynamicUptime, setDynamicUptime] = React.useState(data.uptimePct);
  const [dynamicMemory, setDynamicMemory] = React.useState(data.systemMemoryPercent);
  
  // Heatmap State
  const [heatmapCells, setHeatmapCells] = React.useState<HeatmapCell[]>(() => generateInitialHeatmapData());
  const [heatmapMetric, setHeatmapMetric] = React.useState<'latency' | 'failureRate'>('latency');
  const [selectedHeatCell, setSelectedHeatCell] = React.useState<HeatmapCell | null>(null);

  // Auto-polling interval effect
  React.useEffect(() => {
    if (!isLiveActive) return;

    const timer = setInterval(() => {
      setSecondsToNextPoll(prev => {
        if (prev <= 1) {
          // Mutate telemetry state for active visual feedback
          setDynamicSlas(s => Math.max(1, Math.min(10, s + (Math.random() > 0.55 ? 1 : -1))));
          setDynamicCsat(c => Math.min(100, Math.max(90, +(c + (Math.random() > 0.5 ? 0.1 : -0.1)).toFixed(1))));
          setDynamicCpu(u => Math.min(100, Math.max(20, +(u + (Math.random() > 0.5 ? 3 : -3)).toFixed(1))));
          setDynamicUptime(p => Math.min(100, Math.max(99.5, +(p + (Math.random() > 0.5 ? 0.01 : -0.01)).toFixed(3))));
          setDynamicMemory(m => Math.min(100, Math.max(40, +(m + (Math.random() > 0.5 ? 2 : -2)).toFixed(1))));

          // Randomize heat cells
          setHeatmapCells(oldCells => oldCells.map(cell => {
            if (Math.random() > 0.3) return cell; // 30% fluctuation rate
            const deltaLat = Math.round((Math.random() - 0.5) * 60);
            const deltaFail = +((Math.random() - 0.5) * 0.4).toFixed(2);
            return {
              ...cell,
              latency: Math.max(20, cell.latency + deltaLat),
              failureRate: Math.max(0, +(cell.failureRate + deltaFail).toFixed(2))
            };
          }));

          // Dispatch toast message
          window.dispatchEvent(new CustomEvent('show-toast', {
            detail: { message: 'Operational telemetry auto-polled: Cluster microservices synchronized.' }
          }));

          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLiveActive]);

  const handleExportPDF = () => {
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
    const ACCENT_RED = [239, 68, 68]; // Red
    const ACCENT_EMERALD = [16, 185, 129]; // Emerald

    // Background header band
    doc.setFillColor(SECONDARY[0], SECONDARY[1], SECONDARY[2]);
    doc.rect(0, 0, 210, 38, 'F');

    // Header Title
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(15);
    doc.text("SUPPORTPILOT METRICS & SLA COMPLIANCE REPORT", 15, 16);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(165, 180, 252); // Indigo-200ish
    doc.text("AUTOMATED TELEMETRY DIGEST & INFRASTRUCTURE INCIDENT DEBRIEF", 15, 22);

    // Header metadata
    doc.setTextColor(203, 213, 225);
    doc.setFontSize(8);
    const dateStr = new Date().toLocaleString();
    doc.text(`Generated: ${dateStr}`, 15, 30);
    doc.text(`Compliance Check: CTO Handshake Active`, 130, 30);

    // Section 1: Executive Assessment Summary
    doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.text("1. EXECUTIVE ASSESSMENT SUMMARY", 15, 48);
    
    // Draw line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, 50, 195, 50);

    // Metadata grid background box
    doc.setFillColor(248, 250, 252);
    doc.rect(15, 53, 180, 20, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.rect(15, 53, 180, 20, 'S');

    // Metadata details
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Selected Range:", 20, 60);
    doc.setFont("Helvetica", "normal");
    doc.text(timeRange, 46, 60);

    doc.setFont("Helvetica", "bold");
    doc.text("Generated On:", 110, 60);
    doc.setFont("Helvetica", "normal");
    doc.text(dateStr, 134, 60);

    doc.setFont("Helvetica", "bold");
    doc.text("Chief Auditor:", 20, 67);
    doc.setFont("Helvetica", "normal");
    doc.text("Eshan Barua (CTO)", 46, 67);

    doc.setFont("Helvetica", "bold");
    doc.text("Prod Cluster:", 110, 67);
    doc.setFont("Helvetica", "normal");
    doc.text("cluster-prod-1", 134, 67);

    // Summary description text
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    const summaryText = `During the analyzed range of ${timeRange}, the cluster-prod-1 environment registered an operational SLA compliance rate of ${data.uptimePct}%. Our customer satisfaction score remained robust at ${data.csat}%, demonstrating healthy client relations despite telemetry disruptions. Distributed tracing clusters recorded CPU load levels at an average of ${data.cpuUtilization}% with automatic remedial actions taking charge of ${data.remediationUptake}% of critical system exceptions under SupportPilot's multi-agent neural dispatch.`;
    const splitSummary = doc.splitTextToSize(summaryText, 180);
    doc.text(splitSummary, 15, 80);

    // Section 2: Key Performance Indicators
    const kpiY = 82 + (splitSummary.length * 4.5);
    doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.text("2. KEY PERFORMANCE INDICATORS", 15, kpiY);
    doc.setDrawColor(226, 232, 240);
    doc.line(15, kpiY + 2, 195, kpiY + 2);

    // KPI Cards: Uptime, CSAT, Active SLA, Remediation
    const cardY = kpiY + 5;
    const cardW = 42;
    const cardH = 20;
    
    // SLA Uptime card
    doc.setFillColor(248, 250, 252);
    doc.rect(15, cardY, cardW, cardH, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(15, cardY, cardW, cardH, 'S');
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
    doc.text(`${data.uptimePct}%`, 15 + cardW/2, cardY + 8, { align: 'center' });
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(TEXT_LIGHT[0], TEXT_LIGHT[1], TEXT_LIGHT[2]);
    doc.text("SLA Uptime Rate", 15 + cardW/2, cardY + 14, { align: 'center' });

    // CSAT card
    doc.setFillColor(248, 250, 252);
    doc.rect(60, cardY, cardW, cardH, 'F');
    doc.rect(60, cardY, cardW, cardH, 'S');
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
    doc.text(`${data.csat}%`, 60 + cardW/2, cardY + 8, { align: 'center' });
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(TEXT_LIGHT[0], TEXT_LIGHT[1], TEXT_LIGHT[2]);
    doc.text("CSAT Score", 60 + cardW/2, cardY + 14, { align: 'center' });

    // Active Outages card
    doc.setFillColor(248, 250, 252);
    doc.rect(105, cardY, cardW, cardH, 'F');
    doc.rect(105, cardY, cardW, cardH, 'S');
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(ACCENT_RED[0], ACCENT_RED[1], ACCENT_RED[2]);
    doc.text(`${data.activeSlas}`, 105 + cardW/2, cardY + 8, { align: 'center' });
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(TEXT_LIGHT[0], TEXT_LIGHT[1], TEXT_LIGHT[2]);
    doc.text("Active Outages", 105 + cardW/2, cardY + 14, { align: 'center' });

    // Remediation Uptake card
    doc.setFillColor(248, 250, 252);
    doc.rect(150, cardY, cardW, cardH, 'F');
    doc.rect(150, cardY, cardW, cardH, 'S');
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(ACCENT_EMERALD[0], ACCENT_EMERALD[1], ACCENT_EMERALD[2]);
    doc.text(`${data.remediationUptake}%`, 150 + cardW/2, cardY + 8, { align: 'center' });
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(TEXT_LIGHT[0], TEXT_LIGHT[1], TEXT_LIGHT[2]);
    doc.text("Auto-Remediation", 150 + cardW/2, cardY + 14, { align: 'center' });

    // Section 3: Historical Outage Incident Trends (Table)
    const tableY = cardY + cardH + 8;
    doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.text("3. HISTORICAL OUTAGE INCIDENT TRENDS", 15, tableY);
    doc.setDrawColor(226, 232, 240);
    doc.line(15, tableY + 2, 195, tableY + 2);

    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(15, tableY + 4, 180, 7, 'F');
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Reporting Cycle", 20, tableY + 9);
    doc.text("Incident Count", 70, tableY + 9);
    doc.text("Operating Status", 120, tableY + 9);
    doc.text("AI Diagnostic Coverage", 160, tableY + 9);

    // Table Rows
    let rowY = tableY + 11;
    doc.setFont("Helvetica", "normal");
    data.incidentTrends.forEach((t) => {
      doc.text(t.label, 20, rowY + 4);
      doc.setFont("Helvetica", "bold");
      doc.text(`${t.value} incidents`, 70, rowY + 4);
      doc.setFont("Helvetica", "normal");
      doc.text("OPERATIONAL", 120, rowY + 4);
      doc.text("100% Neural Indexed", 160, rowY + 4);
      
      // Draw row separator line
      doc.setDrawColor(241, 245, 249);
      doc.line(15, rowY + 6, 195, rowY + 6);
      rowY += 6;
    });

    // Section 4: Live Telemetry & Machine Learning Eviction Predictor
    const forensicY = rowY + 8;
    doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.text("4. PREDICTIVE OUTAGE & CAPACITY RISK FORECAST", 15, forensicY);
    doc.setDrawColor(226, 232, 240);
    doc.line(15, forensicY + 2, 195, forensicY + 2);

    // Predictive Details Box
    doc.setFillColor(248, 250, 252);
    doc.rect(15, forensicY + 5, 180, 25, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(15, forensicY + 5, 180, 25, 'S');

    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.text("ESTIMATED PEAK RATE:", 20, forensicY + 11);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(ACCENT_RED[0], ACCENT_RED[1], ACCENT_RED[2]);
    doc.text("15.8 - 18.2 incidents/hour", 62, forensicY + 11);

    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    doc.setFont("Helvetica", "bold");
    doc.text("EXPECTED PEAK TIME:", 20, forensicY + 16);
    doc.setFont("Helvetica", "normal");
    doc.text("+12 Hours (~10:00 UTC)", 62, forensicY + 16);

    doc.setFont("Helvetica", "bold");
    doc.text("SLA VIOLATION RISK:", 20, forensicY + 21);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(ACCENT_RED[0], ACCENT_RED[1], ACCENT_RED[2]);
    doc.text("HIGH (82%) - ML ENGINE ARMA-X TREND-ADAPTIVE", 62, forensicY + 21);

    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    doc.setFont("Helvetica", "bold");
    doc.text("REMEDIATION DIRECTIVE:", 20, forensicY + 26);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
    doc.text("Pre-warm connection pools & scale worker nodes before peak load.", 62, forensicY + 26);

    // Footer signature block at bottom
    doc.setFillColor(SECONDARY[0], SECONDARY[1], SECONDARY[2]);
    doc.rect(0, 282, 210, 15, 'F');
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("SUPPORTPILOT INTEGRATED MANAGEMENT COMPLIANCE", 15, 291);
    doc.setFont("Helvetica", "normal");
    doc.text("Page 1 of 1", 180, 291);

    // Save PDF
    doc.save(`SupportPilot_Metrics_SLA_Report.pdf`);

    window.dispatchEvent(new CustomEvent('show-toast', { 
      detail: { message: "Operational Telemetry PDF Report downloaded successfully!" } 
    }));
  };

  const renderWeeklyIncidentVolumeChart = () => {
    return (
      <div className="bento-card-premium p-5 flex flex-col h-[320px]">
        <div className="mb-4 flex items-center justify-between text-xxs border-b border-slate-800/40 pb-2.5">
          <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
            <Icons.BarChart3 className="h-4 w-4 text-indigo-400" />
            <span className="font-display font-medium text-white">Weekly Incident Volume Trend</span>
          </span>
          <span className="rounded bg-indigo-500/15 px-2 py-0.5 font-mono text-[8px] font-bold text-indigo-400 border border-indigo-500/30">
            PAST 7 DAYS
          </span>
        </div>
        
        <div className="flex-1 w-full min-h-0 text-[9px] font-mono">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.incidentTrends} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorWeeklyVolume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.85}/>
                  <stop offset="95%" stopColor="#4338ca" stopOpacity={0.15}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.05)" />
              <XAxis 
                dataKey="label" 
                stroke="#475569" 
                tickLine={false} 
                fontSize={9}
                dy={8}
              />
              <YAxis 
                stroke="#475569" 
                tickLine={false} 
                fontSize={9}
                dx={-8}
                allowDecimals={false}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(99, 102, 241, 0.04)' }}
                content={({ active, payload }: any) => {
                  if (active && payload && payload.length) {
                    const entry = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-slate-800 bg-slate-950/95 p-2.5 font-mono text-[10px] shadow-2xl backdrop-blur-md">
                        <p className="font-bold text-white mb-1.5 border-b border-slate-900 pb-1 flex items-center justify-between">
                          <span>Reporting Day:</span>
                          <span className="text-indigo-400">{entry.label}</span>
                        </p>
                        <div className="flex items-center justify-between space-x-4">
                          <span className="text-slate-400">Total Outages:</span>
                          <span className="font-bold text-white">{entry.value} incidents</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                name="Total Outages"
                dataKey="value" 
                fill="url(#colorWeeklyVolume)" 
                radius={[4, 4, 0, 0]}
                barSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderMTTRChart = () => {
    return (
      <div className="bento-card-premium p-5 flex flex-col h-[320px]">
        <div className="mb-4 flex items-center justify-between text-xxs border-b border-slate-800/40 pb-2.5">
          <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
            <Icons.Zap className="h-4 w-4 text-emerald-400" />
            <span className="font-display font-medium text-white">Mean Time to Resolve (MTTR)</span>
          </span>
          <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[8px] font-bold text-emerald-400 border border-emerald-500/30">
            LAST 30 DAYS
          </span>
        </div>

        <div className="flex-1 w-full min-h-0 text-[9px] font-mono">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mttrData30Days} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.05)" />
              <XAxis 
                dataKey="day" 
                stroke="#475569" 
                tickLine={false} 
                fontSize={9}
                dy={8}
              />
              <YAxis 
                stroke="#475569" 
                tickLine={false} 
                fontSize={9}
                dx={-8}
                unit="m"
              />
              <Tooltip 
                content={({ active, payload }: any) => {
                  if (active && payload && payload.length) {
                    const entry = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-slate-800 bg-slate-950/95 p-2.5 font-mono text-[10px] shadow-2xl backdrop-blur-md">
                        <p className="font-bold text-white mb-1.5 border-b border-slate-900 pb-1 flex items-center justify-between">
                          <span>Timeline:</span>
                          <span className="text-emerald-400">{entry.day}</span>
                        </p>
                        <div className="flex items-center justify-between space-x-4">
                          <span className="text-slate-400">Avg MTTR:</span>
                          <span className="font-bold text-white">{entry.mttr} minutes</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line 
                type="monotone" 
                dataKey="mttr" 
                stroke="#10b981" 
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#10b981', stroke: '#020617', strokeWidth: 1.5 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 text-[9px] text-slate-500 flex justify-between items-center border-t border-slate-900/60 pt-2 font-mono">
          <span>MTTR TARGET: &lt; 15m</span>
          <span className="text-emerald-400 font-bold">11m CURRENT Avg</span>
        </div>
      </div>
    );
  };

  const renderPredictiveForecastSection = () => {
    return (
      <div className="bento-card-premium p-5 mt-4 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/40 pb-3">
          <div className="flex items-center space-x-2">
            <Icons.Sparkles className="h-4.5 w-4.5 text-amber-400 animate-pulse" />
            <span className="font-display font-bold text-sm text-white">Dynamic Peak-Load Incident Forecasting</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="rounded bg-indigo-500/10 px-2 py-0.5 font-mono text-[8px] font-bold text-indigo-400 border border-indigo-500/20 uppercase">
              ML Engine: ARMA-X Trend-Adaptive
            </span>
            <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[8px] text-slate-400 border border-slate-800 uppercase">
              Confidence Interval: 95%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-5">
          {/* Left Column: Recharts Chart */}
          <div className="col-span-8 bg-slate-950/40 border border-slate-900 rounded-xl p-4 h-[240px] flex flex-col justify-between">
            <div className="flex justify-between items-center text-xxs font-mono text-slate-400 mb-2">
              <span className="flex items-center space-x-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                <span>Predicted Rate (Incidents/Hour)</span>
              </span>
              <span className="text-amber-400 font-bold flex items-center space-x-1">
                <Icons.AlertTriangle className="h-3 w-3" />
                <span>Estimated Peak: +12 Hours</span>
              </span>
            </div>
            
            <div className="flex-1 min-h-0 text-[8px] font-mono">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#475569" stopOpacity={0.08}/>
                      <stop offset="95%" stopColor="#475569" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.03)" />
                  <XAxis dataKey="hour" stroke="#475569" tickLine={false} fontSize={8.5} dy={5} />
                  <YAxis stroke="#475569" tickLine={false} fontSize={8.5} dx={-5} />
                  <Tooltip 
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const dataVal = payload[0].payload;
                        return (
                          <div className="rounded-xl border border-slate-800 bg-slate-950/95 p-2.5 font-mono text-[9px] shadow-2xl backdrop-blur-md">
                            <p className="font-bold text-white mb-1.5 border-b border-slate-900 pb-1 text-indigo-400">
                              {dataVal.hour}
                            </p>
                            <div className="space-y-1">
                              <div className="flex justify-between space-x-4">
                                <span className="text-slate-400">Predicted Load:</span>
                                <span className="font-bold text-indigo-400">{dataVal.predicted} inc/hr</span>
                              </div>
                              <div className="flex justify-between space-x-4">
                                <span className="text-slate-500">Confidence Band:</span>
                                <span className="text-slate-400">{dataVal.lowerConfidence} - {dataVal.upperConfidence} inc/hr</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area 
                    name="Upper Bound"
                    type="monotone" 
                    dataKey="upperConfidence" 
                    stroke="transparent" 
                    fill="url(#colorConfidence)" 
                    fillOpacity={1}
                  />
                  <Area 
                    name="Forecast"
                    type="monotone" 
                    dataKey="predicted" 
                    stroke="#6366f1" 
                    strokeWidth={2}
                    fill="url(#colorForecast)" 
                    fillOpacity={1}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right Column: Predictive Telemetry */}
          <div className="col-span-4 bg-slate-950/40 border border-slate-900 rounded-xl p-4 flex flex-col justify-between h-[240px]">
            <div>
              <span className="font-bold text-slate-300 block text-[8px] uppercase tracking-wider mb-2.5">
                Proactive Capacity Risk Analysis
              </span>
              
              <div className="space-y-2 font-mono text-[8.5px]">
                <div className="flex justify-between items-center bg-slate-900/30 px-2 py-1 rounded border border-slate-900/60">
                  <span className="text-slate-500">PEAK FORECAST RATE:</span>
                  <span className="text-rose-400 font-bold">15.8 - 18.2 inc/hr</span>
                </div>
                <div className="flex justify-between items-center bg-slate-900/30 px-2 py-1 rounded border border-slate-900/60">
                  <span className="text-slate-500">EXPECTED PEAK TIME:</span>
                  <span className="text-amber-400 font-bold">+12 Hours (~10:00 UTC)</span>
                </div>
                <div className="flex justify-between items-center bg-slate-900/30 px-2 py-1 rounded border border-slate-900/60">
                  <span className="text-slate-500">SLA VIOLATION RISK:</span>
                  <span className="text-rose-400 font-bold uppercase">HIGH (82%)</span>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-900/80 pt-2.5">
              <span className="text-[7.5px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">
                ADAPTIVE REMEDIATION INSTRUCTIONS:
              </span>
              <ul className="text-[7.5px] text-slate-400 leading-normal space-y-1">
                <li className="flex items-start space-x-1">
                  <span className="text-indigo-400 font-bold shrink-0">•</span>
                  <span>Auto-scale worker pods to 16 replicas before peak load (+10h).</span>
                </li>
                <li className="flex items-start space-x-1">
                  <span className="text-indigo-400 font-bold shrink-0">•</span>
                  <span>Pre-warm Postgres connection pools to prevent lockouts.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderLiveIncidentVelocityChart = () => {
    return (
      <div className="bento-card-premium p-5 flex flex-col h-[320px]">
        <div className="mb-4 flex items-center justify-between text-xxs border-b border-slate-800/40 pb-2.5">
          <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
            <Icons.TrendingUp className="h-4 w-4 text-indigo-400" />
            <span className="font-display font-medium text-white">Live Incident Velocity (Last 24 Hours)</span>
          </span>
          <span className="rounded bg-indigo-500/15 px-2 py-0.5 font-mono text-[8px] font-bold text-indigo-400 border border-indigo-500/30">
            SIGNALR STREAMING
          </span>
        </div>
        
        <div className="flex-1 w-full min-h-0 text-[9px] font-mono">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={liveIncidentVelocityData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="colorMedium" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.05)" />
              <XAxis 
                dataKey="interval" 
                stroke="#475569" 
                tickLine={false} 
                fontSize={9}
                dy={8}
              />
              <YAxis 
                stroke="#475569" 
                tickLine={false} 
                fontSize={9}
                dx={-8}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="top" 
                height={36} 
                iconType="circle"
                iconSize={6}
                wrapperStyle={{ fontSize: '9px', paddingBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              />
              <Area 
                name="Critical Priority"
                type="monotone" 
                dataKey="critical" 
                stroke="#f43f5e" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorCritical)" 
                activeDot={{ r: 4 }}
              />
              <Area 
                name="High Priority"
                type="monotone" 
                dataKey="high" 
                stroke="#f59e0b" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorHigh)" 
                activeDot={{ r: 4 }}
              />
              <Area 
                name="Medium / Low Priority"
                type="monotone" 
                dataKey="medium" 
                stroke="#6366f1" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorMedium)" 
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderEndpointHeatmap = () => {
    return (
      <div className="bento-card-premium p-5 flex flex-col">
        <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/40 pb-3">
          <div>
            <h4 className="font-display font-semibold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-2 text-white">
              <Icons.Grid className="h-4.5 w-4.5 text-indigo-400 animate-pulse" />
              <span>API Gateway Performance Heatmap</span>
            </h4>
            <p className="text-[10px] text-slate-500 mt-0.5 font-mono">Highlights transient bottlenecks, service level degradations, and high-latency endpoints.</p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="font-mono text-[9px] text-slate-400 font-bold uppercase mr-1">MEASUREMENT METRIC:</span>
            <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-0.5">
              <button
                onClick={() => setHeatmapMetric('latency')}
                className={`px-2.5 py-1 rounded font-mono text-[9px] font-bold transition-all cursor-pointer ${
                  heatmapMetric === 'latency' 
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                LATENCY
              </button>
              <button
                onClick={() => setHeatmapMetric('failureRate')}
                className={`px-2.5 py-1 rounded font-mono text-[9px] font-bold transition-all cursor-pointer ${
                  heatmapMetric === 'failureRate' 
                    ? 'bg-rose-600/20 text-rose-400 border border-rose-500/20' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                ERRORS (%)
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* THE GRID */}
          <div className="lg:col-span-9 overflow-x-auto">
            <div className="min-w-[640px] space-y-1.5 select-none">
              {/* Header Columns */}
              <div className="flex items-center font-mono text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                <div className="w-[190px] shrink-0 text-left">API Endpoint Route</div>
                <div className="flex-1 flex justify-between">
                  {timeSlots.map(slot => (
                    <div key={slot} className="w-9 text-center">{slot}</div>
                  ))}
                </div>
              </div>

              {/* Rows */}
              {apiEndpoints.map((ep, epIdx) => {
                return (
                  <div key={ep.path} className="flex items-center group">
                    {/* Endpoint details */}
                    <div className="w-[190px] shrink-0 text-left pr-2 truncate">
                      <div className="font-bold text-white text-[9.5px] leading-tight group-hover:text-indigo-400 transition-colors">{ep.path}</div>
                      <div className="text-[8px] text-slate-500 font-mono">{ep.service}</div>
                    </div>

                    {/* Cells */}
                    <div className="flex-1 flex justify-between gap-1">
                      {timeSlots.map((slot, tIdx) => {
                        const cell = heatmapCells.find(c => c.endpointIndex === epIdx && c.timeSlotIndex === tIdx);
                        if (!cell) return null;

                        // Calculate cell color based on active metric
                        let cellBg = 'bg-slate-900 border-slate-900';
                        let valText = '';
                        
                        if (heatmapMetric === 'latency') {
                          valText = `${cell.latency}ms`;
                          if (cell.latency < 150) {
                            cellBg = 'bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/15 hover:bg-emerald-500/20';
                          } else if (cell.latency < 350) {
                            cellBg = 'bg-emerald-500/35 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/50';
                          } else if (cell.latency < 600) {
                            cellBg = 'bg-amber-500/25 text-amber-300 border border-amber-500/30 hover:bg-amber-500/40';
                          } else if (cell.latency < 900) {
                            cellBg = 'bg-orange-500/40 text-orange-300 border border-orange-500/50 hover:bg-orange-500/60';
                          } else {
                            cellBg = 'bg-rose-500/35 text-rose-300 border border-rose-500/50 hover:bg-rose-500/50 animate-pulse';
                          }
                        } else {
                          valText = `${cell.failureRate}%`;
                          if (cell.failureRate < 0.5) {
                            cellBg = 'bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/15 hover:bg-emerald-500/20';
                          } else if (cell.failureRate < 1.5) {
                            cellBg = 'bg-emerald-500/35 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/50';
                          } else if (cell.failureRate < 3.0) {
                            cellBg = 'bg-amber-500/25 text-amber-300 border border-amber-500/30 hover:bg-amber-500/40';
                          } else if (cell.failureRate < 5.0) {
                            cellBg = 'bg-orange-500/40 text-orange-300 border border-orange-500/50 hover:bg-orange-500/60';
                          } else {
                            cellBg = 'bg-rose-500/35 text-rose-300 border border-rose-500/50 hover:bg-rose-500/50 animate-pulse';
                          }
                        }

                        const isSelected = selectedHeatCell?.endpointIndex === epIdx && selectedHeatCell?.timeSlotIndex === tIdx;

                        return (
                          <button
                            key={slot}
                            onClick={() => setSelectedHeatCell(cell)}
                            className={`w-9 h-7 rounded font-mono text-[8px] font-bold flex items-center justify-center transition-all cursor-pointer relative ${cellBg} ${
                              isSelected ? 'ring-2 ring-indigo-400 scale-105 z-10 border-white' : ''
                            }`}
                            title={`${ep.path} @ ${slot} - Latency: ${cell.latency}ms, Failures: ${cell.failureRate}%`}
                          >
                            <span>{valText}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-[9px] font-mono border-t border-slate-900 pt-3">
              <span className="text-slate-500 font-bold uppercase">Legend:</span>
              <div className="flex items-center space-x-1.5">
                <span className="h-3 w-5 rounded bg-emerald-500/10 border border-emerald-500/15 block" />
                <span className="text-slate-400">Optimal ({heatmapMetric === 'latency' ? '< 150ms' : '< 0.5%'})</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="h-3 w-5 rounded bg-emerald-500/35 border border-emerald-500/40 block" />
                <span className="text-slate-400">Normal ({heatmapMetric === 'latency' ? '150-350ms' : '0.5-1.5%'})</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="h-3 w-5 rounded bg-amber-500/25 border border-amber-500/30 block" />
                <span className="text-slate-400">Elevated ({heatmapMetric === 'latency' ? '350-600ms' : '1.5-3.0%'})</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="h-3 w-5 rounded bg-orange-500/40 border border-orange-500/50 block" />
                <span className="text-slate-400">Degraded ({heatmapMetric === 'latency' ? '600-900ms' : '3.0-5.0%'})</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="h-3 w-5 rounded bg-rose-500/35 border border-rose-500/50 block animate-pulse" />
                <span className="text-slate-400">Critical ({heatmapMetric === 'latency' ? '> 900ms' : '> 5.0%'})</span>
              </div>
            </div>
          </div>

          {/* INSPECTOR PANEL */}
          <div className="lg:col-span-3 bg-slate-950/50 border border-slate-900 rounded-xl p-4 flex flex-col justify-between h-full min-h-[180px]">
            {selectedHeatCell ? (() => {
              const ep = apiEndpoints[selectedHeatCell.endpointIndex];
              const slot = timeSlots[selectedHeatCell.timeSlotIndex];
              
              let statusLabel = 'HEALTHY';
              let statusColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
              let diagnosis = 'Endpoint operates within standard SLA criteria. Network pipeline is nominal.';

              if (selectedHeatCell.latency > 900 || selectedHeatCell.failureRate > 5.0) {
                statusLabel = 'OUTAGE INTERCEPTED';
                statusColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
                diagnosis = 'OOM thrashing on database thread locks. Prompt-initiated runbooks are scheduled.';
              } else if (selectedHeatCell.latency > 600 || selectedHeatCell.failureRate > 3.0) {
                statusLabel = 'DEGRADED TRACE';
                statusColor = 'text-orange-400 bg-orange-500/10 border-orange-500/20';
                diagnosis = 'Elevated load pools. Recommend scaling backend agent pod replicas.';
              } else if (selectedHeatCell.latency > 350 || selectedHeatCell.failureRate > 1.5) {
                statusLabel = 'ELEVATED QUEUE';
                statusColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
                diagnosis = 'Minor resource contentions. Dynamic broker throttling active.';
              }

              return (
                <div className="space-y-4 h-full flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                      <span className="font-mono text-[8px] text-slate-500 uppercase tracking-widest">Telemetry Inspector</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </div>

                    <div className="space-y-1 font-mono text-[9px]">
                      <div>
                        <span className="text-slate-500">ENDPOINT:</span>
                        <div className="text-white font-bold font-sans break-all mt-0.5">{ep.path}</div>
                      </div>
                      <div>
                        <span className="text-slate-500">SERVICE CLUST:</span>
                        <div className="text-indigo-300 font-bold mt-0.5">{ep.service}</div>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-900/40 pt-2 mt-2">
                        <span className="text-slate-500">INTERVAL:</span>
                        <span className="text-white font-bold">{slot} UTC</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">LATENCY:</span>
                        <span className="text-amber-400 font-bold">{selectedHeatCell.latency} ms</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">FAIL RATE:</span>
                        <span className="text-rose-400 font-bold">{selectedHeatCell.failureRate}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-900 pt-3.5 mt-2">
                    <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                      ANALYST DIAGNOSIS & REMEDY
                    </span>
                    <p className="text-[9.5px] text-slate-400 leading-relaxed font-sans">{diagnosis}</p>
                  </div>
                </div>
              );
            })() : (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <Icons.Layers className="h-8 w-8 text-slate-800 mb-2.5 animate-pulse" />
                <span className="text-[10px] text-slate-400 font-bold">Trace Inspector Idle</span>
                <p className="text-[9px] text-slate-600 mt-1 leading-snug">Click on any heatmap cell to run automated tracing and SLA root cause analysis.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 font-sans text-xs">
      {/* FILTER & EXPORT ACTIONS BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 mb-2">
        <div>
          <h3 className="font-display font-bold text-sm text-white">Operational Telemetry Report Engine</h3>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">Generate compliance post-mortems and export executive digests.</p>
        </div>
        <div className="flex items-center space-x-3 shrink-0">
          {/* Time Range Selector */}
          <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
            <Icons.Calendar className="h-3.5 w-3.5 text-slate-500" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-transparent text-slate-300 font-mono text-[10px] outline-none border-none cursor-pointer pr-4 font-bold"
            >
              <option value="Last 24 Hours">Last 24 Hours</option>
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="Last 30 Days">Last 30 Days</option>
            </select>
          </div>

          {/* Live Data Auto-Polling Toggle */}
          <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className={`absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${isLiveActive ? 'animate-ping' : ''}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isLiveActive ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
            </span>
            <span className="font-mono text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              {isLiveActive ? `LIVE (POLL: ${secondsToNextPoll}s)` : 'STATIC'}
            </span>
            <button
              onClick={() => {
                setIsLiveActive(!isLiveActive);
                setSecondsToNextPoll(30);
                window.dispatchEvent(new CustomEvent('show-toast', {
                  detail: { message: !isLiveActive ? 'Live auto-polling active: querying metrics every 30s.' : 'Live polling disabled.' }
                }));
              }}
              className={`relative inline-flex h-[18px] w-[32px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${isLiveActive ? 'bg-emerald-500' : 'bg-slate-800'}`}
            >
              <span
                className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isLiveActive ? 'translate-x-[14px]' : 'translate-x-0'}`}
              />
            </button>
          </div>

          {/* Export to PDF Button */}
          <button
            onClick={handleExportPDF}
            className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2 rounded-lg font-bold text-white shadow-lg shadow-indigo-600/10 cursor-pointer transition-all"
          >
            <Icons.FileText className="h-3.5 w-3.5" />
            <span>Export to PDF</span>
          </button>
        </div>
      </div>

      {/* 1. HIGH DENSITY METRIC CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        
        {/* CARD 1: ACTIVE SLAS */}
        <div className="bento-card-premium p-4 relative overflow-hidden flex items-center justify-between group">
          <div className="space-y-1 z-10 w-full pr-4">
            <div className="flex items-center space-x-1 text-xxs font-bold text-slate-400 uppercase tracking-wider font-display">
              <span>Active Outage SLAs</span>
              
              {/* Tooltip */}
              <div className="relative group/tooltip inline-block">
                <Icons.HelpCircle className="h-3.5 w-3.5 text-slate-500 hover:text-white transition-colors cursor-pointer" />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block z-50 w-52 rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-[9px] font-mono font-normal text-slate-400 shadow-xl leading-normal pointer-events-none normal-case">
                  <span className="font-bold text-indigo-400 uppercase tracking-wider text-[8px] block mb-1">Severity Calculation</span>
                  Calculated based on active production exceptions, tenant tier impact, and automated trace latency degradation coefficients.
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                </div>
              </div>
            </div>
            <div className="text-3xl font-black text-indigo-400 font-display tracking-tight transition-transform duration-300 group-hover:scale-105 origin-left">
              {dynamicSlas}
            </div>
            <div className="text-[10px] text-indigo-300/80">Under strict telemetry alert</div>
          </div>
          <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/10 p-3 text-indigo-400 transition-colors duration-300 group-hover:bg-indigo-500/10">
            <Icons.AlertTriangle className="h-5.5 w-5.5 animate-pulse" />
          </div>
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-indigo-500/80" />
        </div>

        {/* CARD 2: CSAT RATING */}
        <div className="bento-card-premium p-4 relative overflow-hidden flex items-center justify-between group">
          <div className="space-y-1 z-10 w-full pr-4">
            <div className="flex items-center space-x-1 text-xxs font-bold text-slate-400 uppercase tracking-wider font-display">
              <span>Customer CSAT Benchmark</span>
              
              {/* Tooltip */}
              <div className="relative group/tooltip inline-block">
                <Icons.HelpCircle className="h-3.5 w-3.5 text-slate-500 hover:text-white transition-colors cursor-pointer" />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block z-50 w-52 rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-[9px] font-mono font-normal text-slate-400 shadow-xl leading-normal pointer-events-none normal-case">
                  <span className="font-bold text-emerald-400 uppercase tracking-wider text-[8px] block mb-1">CSAT Scoring Matrix</span>
                  Computed as a rolling average of post-incident client satisfaction ratings across resolved runbooks.
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                </div>
              </div>
            </div>
            <div className="text-3xl font-black text-emerald-400 font-display tracking-tight transition-transform duration-300 group-hover:scale-105 origin-left">
              {dynamicCsat}%
            </div>
            <div className="text-[10px] text-emerald-300/80">+2.4% above SLA requirement</div>
          </div>
          <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-3 text-emerald-400 transition-colors duration-300 group-hover:bg-emerald-500/10">
            <Icons.Heart className="h-5.5 w-5.5" />
          </div>
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-emerald-500/80" />
        </div>

        {/* CARD 3: ACTIVE SYSTEM AGENTS */}
        <div className="bento-card-premium p-4 relative overflow-hidden flex items-center justify-between group">
          <div className="space-y-1 z-10 w-full pr-4">
            <div className="flex items-center space-x-1 text-xxs font-bold text-slate-400 uppercase tracking-wider font-display">
              <span>AI Coprocessors Online</span>
              
              {/* Tooltip */}
              <div className="relative group/tooltip inline-block">
                <Icons.HelpCircle className="h-3.5 w-3.5 text-slate-500 hover:text-white transition-colors cursor-pointer" />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block z-50 w-52 rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-[9px] font-mono font-normal text-slate-400 shadow-xl leading-normal pointer-events-none normal-case">
                  <span className="font-bold text-white uppercase tracking-wider text-[8px] block mb-1">Health Score Calculation</span>
                  Computed dynamically from task resolution rates, average latency, and prompt instruction matching accuracy.
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                </div>
              </div>
            </div>
            <div className="text-3xl font-black text-white font-display tracking-tight transition-transform duration-300 group-hover:scale-105 origin-left">
              {data.activeAgents} <span className="text-xs text-slate-500 font-normal">/ 19</span>
            </div>
            <div className="text-[10px] text-slate-400">Memory matrix synched</div>
          </div>
          <div className="rounded-xl bg-slate-500/5 border border-slate-500/10 p-3 text-slate-400 transition-colors duration-300 group-hover:bg-slate-500/10">
            <Icons.Bot className="h-5.5 w-5.5" />
          </div>
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-slate-500/80" />
        </div>

        {/* CARD 4: PLATFORM UPTIME */}
        <div className="bento-card-premium p-4 relative overflow-hidden flex items-center justify-between group">
          <div className="space-y-1 z-10 w-full pr-4">
            <div className="flex items-center space-x-1 text-xxs font-bold text-slate-400 uppercase tracking-wider font-display">
              <span>Service Level Agreement</span>
              
              {/* Tooltip */}
              <div className="relative group/tooltip inline-block">
                <Icons.HelpCircle className="h-3.5 w-3.5 text-slate-500 hover:text-white transition-colors cursor-pointer" />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block z-50 w-52 rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-[9px] font-mono font-normal text-slate-400 shadow-xl leading-normal pointer-events-none normal-case">
                  <span className="font-bold text-amber-400 uppercase tracking-wider text-[8px] block mb-1">SLA Uptime Tracker</span>
                  Tracks target uptime ratios against core endpoint microservice timeouts and critical container outages.
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                </div>
              </div>
            </div>
            <div className="text-3xl font-black text-amber-400 font-display tracking-tight transition-transform duration-300 group-hover:scale-105 origin-left">
              {dynamicUptime}%
            </div>
            <div className="text-[10px] text-amber-300/80 font-medium">Operational SLA: 99.95%</div>
          </div>
          <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-3 text-amber-400 transition-colors duration-300 group-hover:bg-amber-500/10">
            <Icons.Clock className="h-5.5 w-5.5" />
          </div>
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-amber-500/80" />
        </div>

        {/* CARD 5: MEAN TIME TO RESOLVE (MTTR) */}
        <div className="bento-card-premium p-4 relative overflow-hidden flex items-center justify-between group">
          <div className="space-y-1 z-10 w-full pr-4">
            <div className="flex items-center space-x-1 text-xxs font-bold text-slate-400 uppercase tracking-wider font-display">
              <span>Mean Time To Resolve</span>
              
              {/* Tooltip */}
              <div className="relative group/tooltip inline-block">
                <Icons.HelpCircle className="h-3.5 w-3.5 text-slate-500 hover:text-white transition-colors cursor-pointer" />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block z-50 w-52 rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-[9px] font-mono font-normal text-slate-400 shadow-xl leading-normal pointer-events-none normal-case">
                  <span className="font-bold text-emerald-400 uppercase tracking-wider text-[8px] block mb-1">MTTR Calculation</span>
                  Measures average time elapsed between signal ingestion of critical incidents and executive restoration handshake.
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                </div>
              </div>
            </div>
            <div className="text-3xl font-black text-emerald-400 font-display tracking-tight transition-transform duration-300 group-hover:scale-105 origin-left">
              11 <span className="text-xs text-slate-500 font-normal">mins</span>
            </div>
            <div className="text-[10px] text-emerald-300/80 font-medium">-73% reduction MoM</div>
          </div>
          <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-3 text-emerald-400 transition-colors duration-300 group-hover:bg-emerald-500/10">
            <Icons.Zap className="h-5.5 w-5.5 text-emerald-400 animate-pulse" />
          </div>
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-emerald-500/80" />
        </div>

      </div>

      {/* 2. DUAL INTERACTIVE TELEMETRY GRAPHS ROW */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8">
          {renderLiveIncidentVelocityChart()}
        </div>
        
        {/* Coprocessor Resources Panel */}
        <div className="col-span-4 bento-card-premium p-5 space-y-4 flex flex-col justify-between h-[320px]">
          <div>
            <h4 className="font-display font-semibold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-2 border-b border-slate-800/40 pb-2.5 text-white mb-3">
              <Icons.Cpu className="h-4.5 w-4.5 text-indigo-400" />
              <span>Coprocessor Resources</span>
            </h4>

            {/* Meter 1: System Memory */}
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center justify-between text-xxs font-mono text-slate-400">
                <span>Docker Node Allocations</span>
                <span className="text-white font-bold">{dynamicMemory}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-950 overflow-hidden p-[1px]">
                <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${dynamicMemory}%` }} />
              </div>
            </div>

            {/* Meter 2: CPU Utilization */}
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center justify-between text-xxs font-mono text-slate-400">
                <span>Processor Cluster load</span>
                <span className="text-white font-bold">{dynamicCpu}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-950 overflow-hidden p-[1px]">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${dynamicCpu}%` }} />
              </div>
            </div>

            {/* Meter 3: Remediation SLA uptake */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xxs font-mono text-slate-400">
                <span>Remediation Auto-Approve</span>
                <span className="text-white font-bold">{data.remediationUptake}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-950 overflow-hidden p-[1px]">
                <div className="h-full bg-indigo-400 rounded-full transition-all duration-500" style={{ width: `${data.remediationUptake}%` }} />
              </div>
            </div>
          </div>

          {/* Additional details */}
          <div className="rounded-xl border border-slate-800/40 bg-slate-950/40 p-2.5 font-mono text-[8.5px] text-slate-400 leading-relaxed">
            <div className="space-y-0.5 font-sans">
              <div>• Databases: <span className="text-emerald-400 font-semibold font-mono text-[9px]">Postgres Primary + PGVector</span></div>
              <div>• Brokers: <span className="text-emerald-400 font-semibold font-mono text-[9px]">RabbitMQ Cluster Active</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* API GATEWAY PERFORMANCE HEATMAP */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12">
          {renderEndpointHeatmap()}
        </div>
      </div>

      {/* 3. HISTORICAL OUTAGE TRENDS, MTTR, & ACTIVE REAL-TIME ALERTS */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4">
          {renderWeeklyIncidentVolumeChart()}
        </div>

        <div className="col-span-4">
          {renderMTTRChart()}
        </div>

        <div className="col-span-4 bento-card-premium p-5 flex flex-col justify-between h-[320px]">
          <div>
            <h4 className="mb-4 font-display font-semibold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-2 border-b border-slate-800/40 pb-2.5 text-white">
              <Icons.Activity className="h-4.5 w-4.5 text-indigo-400" />
              <span>Real-Time NOC Telemetry Streams</span>
            </h4>
            <div className="space-y-3 font-mono text-[10px]">
              <div className="flex items-center justify-between rounded-lg border border-rose-500/15 bg-rose-500/5 px-3 py-2.5 text-rose-300">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                  <span className="font-sans leading-relaxed text-xxs truncate">CRITICAL ALERT: Kubernetes Billing Core pod reported OOM (Exit code 137).</span>
                </div>
                <span className="text-slate-500 text-[9px] shrink-0">22:13 UTC</span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-amber-500/15 bg-amber-500/5 px-3 py-2.5 text-amber-300">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="font-sans leading-relaxed text-xxs truncate">WARNING ALERT: PostgreSQL Ledger DB Row lock contention exceeded 28 sessions.</span>
                </div>
                <span className="text-slate-500 text-[9px] shrink-0">22:18 UTC</span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-800/50 bg-slate-900/30 px-3 py-2.5 text-slate-400">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-slate-500/60 shrink-0" />
                  <span className="font-sans leading-relaxed text-xxs truncate">INFO: Redis cache eviction sweep executed. Reclaimed 420MB.</span>
                </div>
                <span className="text-slate-500 text-[9px] shrink-0">21:40 UTC</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/40 bg-slate-950/40 p-3 font-mono text-[9px] text-slate-400 leading-relaxed">
            <span className="font-bold text-slate-300 uppercase tracking-widest text-[8.5px]">CLUSTER NETWORKING:</span>
            <div className="font-sans text-slate-400 mt-1">
              Zone: prod-east-1 • Node Status: <span className="text-emerald-400 font-mono font-semibold">12 pods online</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. DYNAMIC PREDICTIVE PEAK-LOAD FORECASTING (NEXT 24 HOURS) */}
      {renderPredictiveForecastSection()}
    </div>
  );
}

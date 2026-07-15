import React from 'react';
import { SimulatedMetricsDashboard } from '../data/simulation';
import * as Icons from 'lucide-react';
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
  Legend
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

export default function MetricsDashboard() {
  const data = SimulatedMetricsDashboard;
  const [timeRange, setTimeRange] = React.useState('Last 7 Days');

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to export the PDF report.");
      return;
    }

    const currentDate = new Date().toLocaleString();
    const reportHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Post-Mortem Executive Report - ${timeRange}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');
          body {
            font-family: 'Inter', sans-serif;
            color: #0f172a;
            background-color: #ffffff;
            margin: 0;
            padding: 40px;
            font-size: 11px;
            line-height: 1.5;
          }
          .header {
            border-bottom: 2px solid #6366f1;
            padding-bottom: 20px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .title {
            font-size: 20px;
            font-weight: 800;
            letter-spacing: -0.025em;
            color: #1e1b4b;
            margin: 0 0 5px 0;
          }
          .subtitle {
            font-size: 10px;
            color: #475569;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .meta-grid {
            display: grid;
            grid-template-cols: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 30px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 15px;
            border-radius: 8px;
          }
          .meta-item {
            font-size: 10px;
          }
          .meta-label {
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
            font-family: 'JetBrains Mono', monospace;
          }
          .meta-val {
            color: #0f172a;
            font-weight: 700;
            font-size: 11px;
            margin-top: 4px;
          }
          .section-title {
            font-size: 13px;
            font-weight: 700;
            border-left: 3px solid #6366f1;
            padding-left: 10px;
            margin: 25px 0 15px 0;
            color: #1e1b4b;
            text-transform: uppercase;
            letter-spacing: 0.025em;
          }
          .metric-card-grid {
            display: grid;
            grid-template-cols: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 25px;
          }
          .metric-card {
            border: 1px solid #e2e8f0;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
          }
          .metric-num {
            font-size: 22px;
            font-weight: 800;
            color: #4f46e5;
            margin-bottom: 5px;
          }
          .metric-lbl {
            font-size: 9px;
            color: #475569;
            font-weight: 600;
            text-transform: uppercase;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
          }
          th {
            background-color: #f1f5f9;
            color: #334155;
            font-weight: 700;
            font-size: 10px;
            text-transform: uppercase;
            font-family: 'JetBrains Mono', monospace;
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #cbd5e1;
          }
          td {
            padding: 10px;
            font-size: 11px;
            border-bottom: 1px solid #f1f5f9;
          }
          .alert-pill {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: 700;
            font-family: 'JetBrains Mono', monospace;
          }
          .alert-critical { background: #ffe4e6; color: #991b1b; }
          .alert-warning { background: #fef3c7; color: #92400e; }
          .alert-info { background: #e0f2fe; color: #075985; }
          .signature-section {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
            padding-top: 25px;
            border-top: 1px dashed #cbd5e1;
          }
          .signature-box {
            width: 45%;
          }
          .signature-line {
            border-bottom: 1px solid #94a3b8;
            height: 40px;
            margin-bottom: 8px;
          }
          .signature-title {
            font-size: 10px;
            color: #64748b;
            font-weight: 500;
          }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">SUPPORTPILOT POST-MORTEM EXECUTIVE REPORT</h1>
            <p class="subtitle">AUTOMATED SLA COMPLIANCE & INCIDENT ANALYTICS</p>
          </div>
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 9px; text-align: right; color: #64748b;">
            CONFIDENTIAL • OPERATIONS BRANCH
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <div class="meta-label">Selected Range</div>
            <div class="meta-val">${timeRange}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Generated On</div>
            <div class="meta-val">${currentDate}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Chief Auditor</div>
            <div class="meta-val">Eshan Barua (CTO)</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Environment</div>
            <div class="meta-val">cluster-prod-1</div>
          </div>
        </div>

        <div class="section-title">Key Performance Indicators</div>
        <div class="metric-card-grid">
          <div class="metric-card">
            <div class="metric-num">${data.activeSlas}</div>
            <div class="metric-lbl">Active Outages</div>
          </div>
          <div class="metric-card">
            <div class="metric-num">${data.csat}%</div>
            <div class="metric-lbl">CSAT Benchmark</div>
          </div>
          <div class="metric-card">
            <div class="metric-num">${data.uptimePct}%</div>
            <div class="metric-lbl">Operational SLA Uptime</div>
          </div>
          <div class="metric-card">
            <div class="metric-num">${data.remediationUptake}%</div>
            <div class="metric-lbl">Remediation Uptake</div>
          </div>
        </div>

        <div class="section-title">Executive SLA Assessment</div>
        <p style="font-size: 11px; color: #334155; text-align: justify; margin-bottom: 25px;">
          During the analyzed range of <strong>${timeRange}</strong>, the cluster-prod-1 environment registered an operational SLA compliance rate of <strong>${data.uptimePct}%</strong>. Our customer satisfaction score remained robust at <strong>${data.csat}%</strong>, demonstrating healthy client relations despite telemetry disruptions. Distributed tracing clusters recorded CPU load levels at an average of <strong>${data.cpuUtilization}%</strong> with automatic remedial actions taking charge of <strong>${data.remediationUptake}%</strong> of critical system exceptions under SupportPilot's multi-agent neural dispatch.
        </p>

        <div class="section-title">Historical Outage Incident Trends</div>
        <table>
          <thead>
            <tr>
              <th>Reporting Cycle</th>
              <th>Incident Count</th>
              <th>Operating Status</th>
              <th>AI Diagnostic Coverage</th>
            </tr>
          </thead>
          <tbody>
            ${data.incidentTrends.map(t => `
              <tr>
                <td style="font-family: 'JetBrains Mono', monospace; font-weight: bold; color: #4338ca;">${t.label}</td>
                <td><strong>${t.value} incidents</strong></td>
                <td><span class="alert-pill alert-info">OPERATIONAL</span></td>
                <td>100% Neural Indexed</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="section-title">Telemetry NOC Logs (Last Cycles)</div>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; font-family: 'JetBrains Mono', monospace; font-size: 10px; margin-bottom: 30px;">
          <div style="margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; display: flex; justify-content: space-between;">
            <span style="font-weight: bold; color: #991b1b;">[CRITICAL]</span>
            <span style="color: #64748b;">Kubernetes Billing Core pod reported OOM (Exit code 137).</span>
          </div>
          <div style="margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; display: flex; justify-content: space-between;">
            <span style="font-weight: bold; color: #92400e;">[WARNING]</span>
            <span style="color: #64748b;">PostgreSQL Ledger DB Row lock contention exceeded 28 sessions.</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="font-weight: bold; color: #475569;">[INFO]</span>
            <span style="color: #64748b;">Redis cache eviction sweep executed. Reclaimed 420MB.</span>
          </div>
        </div>

        <div class="signature-section">
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-title"><strong>Eshan Barua</strong><br>Chief Technology Officer (CTO)</div>
          </div>
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-title"><strong>NOC Operations Lead</strong><br>Lead Reliability Engineer</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(reportHTML);
    printWindow.document.close();
  };

  // Beautiful Recharts-based Weekly Incident Volume Trend Chart
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
      <div className="grid grid-cols-4 gap-4">
        
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
              {data.activeSlas}
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
              {data.csat}%
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
              {data.uptimePct}%
            </div>
            <div className="text-[10px] text-amber-300/80 font-medium">Operational SLA: 99.95%</div>
          </div>
          <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-3 text-amber-400 transition-colors duration-300 group-hover:bg-amber-500/10">
            <Icons.Clock className="h-5.5 w-5.5" />
          </div>
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-amber-500/80" />
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
                <span className="text-white font-bold">{data.systemMemoryPercent}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-950 overflow-hidden p-[1px]">
                <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${data.systemMemoryPercent}%` }} />
              </div>
            </div>

            {/* Meter 2: CPU Utilization */}
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center justify-between text-xxs font-mono text-slate-400">
                <span>Processor Cluster load</span>
                <span className="text-white font-bold">{data.cpuUtilization}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-950 overflow-hidden p-[1px]">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${data.cpuUtilization}%` }} />
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

      {/* 3. HISTORICAL OUTAGE TRENDS & ACTIVE REAL-TIME ALERTS */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-6">
          {renderWeeklyIncidentVolumeChart()}
        </div>

        <div className="col-span-6 bento-card-premium p-5 flex flex-col justify-between h-[320px]">
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
    </div>
  );
}

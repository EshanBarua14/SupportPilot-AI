import React, { useState, useEffect } from 'react';
import { Incident, LogEntry, TimelineEvent, Tenant } from '../types';
import { InitialIncidents, SeedTenants } from '../data/simulation';
import * as Icons from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import IncidentDetailsDrawer from './IncidentDetailsDrawer';

interface IncidentWorkspaceProps {
  modelSelection: string;
  onAddAuditLog: (operator: string, action: string, module: string, status: 'SUCCESS' | 'FAILED' | 'PENDING_APPROVAL', payload: string) => void;
}

export default function IncidentWorkspace({ modelSelection, onAddAuditLog }: IncidentWorkspaceProps) {
  const [incidents, setIncidents] = useState<Incident[]>(InitialIncidents);
  const [selectedIncident, setSelectedIncident] = useState<Incident>(InitialIncidents[0]);
  const [drawerIncidentId, setDrawerIncidentId] = useState<string | null>(null);

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIncidentIds, setSelectedIncidentIds] = useState<string[]>([]);
  const [priorityOnly, setPriorityOnly] = useState(false);

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
  const [telemetryTab, setTelemetryTab] = useState<'logs' | 'metrics' | 'traces' | 'db' | 'k8s'>('logs');
  
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
            automaticReply: data.automaticReply
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
            csatScore: Math.floor(Math.random() * 15) + 85 // high satisfaction
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
          csatScore: 95
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
        <h3 className="mb-3 font-display font-bold text-sm text-indigo-400 uppercase tracking-wider flex items-center space-x-2 text-white">
          <Icons.ShieldAlert className="h-4.5 w-4.5 text-indigo-400" />
          <span>Active Operations Queue</span>
        </h3>

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

        <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
          {incidents
            .filter((inc) => {
              if (priorityOnly) {
                return inc.severity === 'CRITICAL' || inc.severity === 'HIGH';
              }
              return true;
            })
            .map((inc) => {
              const isSelected = inc.id === selectedIncident.id;
              const isSolved = inc.status === 'SOLVED';
              const isSelectedInBulk = selectedIncidentIds.includes(inc.id);

              return (
                <div
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
                      <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold ${getSeverityBadge(inc.severity)}`}>
                        {inc.severity}
                      </span>
                    </div>
                    
                    <div>
                      <h4 className="font-bold text-white text-xs leading-snug line-clamp-2">{inc.title}</h4>
                      <p className="text-[10px] text-indigo-400 font-medium mt-1 uppercase tracking-wider text-[9px]">{getTenantName(inc.tenantId)}</p>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-800/40 pt-2 text-[10px]">
                      <div className="flex items-center space-x-1 text-slate-400 font-medium">
                        {getChannelIcon(inc.source)}
                        <span className="font-mono text-[9.5px]">{inc.appName}</span>
                      </div>
                      
                      {/* SLA countdown timer */}
                      <div className={`font-mono font-bold text-[9.5px] ${
                        isSolved 
                          ? 'text-emerald-400' 
                          : inc.slaRemainingSecs < 300 
                            ? 'text-rose-400 animate-pulse' 
                            : 'text-amber-400'
                      }`}>
                        {isSolved ? (
                          <span className="flex items-center space-x-1">
                            <Icons.Check className="h-3 w-3" />
                            <span>CSAT {inc.csatScore}%</span>
                          </span>
                        ) : (
                          <span>{formatSlaTime(inc.slaRemainingSecs)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* 2. DYNAMIC WORKSPACE (Tabs + Telemetry Core Middle) */}
      <div className="col-span-5 flex flex-col overflow-hidden bento-card-premium">
        
        {/* Active Ticket Heading Details banner */}
        <div className="border-b border-slate-800/40 bg-slate-950/20 p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2 text-[9.5px] font-mono text-slate-500 mb-1.5">
                <span className="font-semibold">{selectedIncident.id}</span>
                <span>•</span>
                <span className="text-indigo-400 font-bold">{getTenantName(selectedIncident.tenantId)}</span>
                <span>•</span>
                <span className="font-medium">{selectedIncident.appName}</span>
              </div>
              <h2 className="font-display font-bold text-sm text-white leading-snug">{selectedIncident.title}</h2>
            </div>
            <div className="flex items-center space-x-2">
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
          
          <div className="mt-3.5 text-slate-300 bg-slate-950/40 border border-slate-800/40 rounded-xl p-3 text-xxs leading-relaxed select-text font-sans shadow-inner">
            <span className="font-bold text-slate-400 uppercase tracking-wider mr-1.5 text-[8.5px]">Description:</span>
            {selectedIncident.description}
          </div>
        </div>

        {/* Telemetry Tabs Selector */}
        <div className="flex items-center space-x-1 border-b border-slate-800/40 bg-slate-950/10 px-3 pt-2">
          {[
            { id: 'logs', label: 'Logs Stream', icon: Icons.FileText },
            { id: 'metrics', label: 'Metrics', icon: Icons.TrendingUp },
            { id: 'traces', label: 'Distributed Tracing', icon: Icons.GitFork },
            { id: 'db', label: 'Database', icon: Icons.Database },
            { id: 'k8s', label: 'ArgoCD / K8s', icon: Icons.Network }
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

              <div className="rounded-lg border border-slate-900 bg-slate-950/80 p-3 font-mono text-[10px] leading-relaxed space-y-1.5 max-h-[220px] overflow-y-auto select-text">
                {filteredLogs.map((line, i) => {
                  const isErr = line.level === 'FATAL' || line.level === 'ERROR';
                  const isWarn = line.level === 'WARN';
                  return (
                    <div key={i} className="flex items-start space-x-2">
                      <span className="text-slate-600 shrink-0">{line.timestamp.slice(11, 19)}</span>
                      <span className={`shrink-0 font-bold ${
                        isErr ? 'text-rose-500' : isWarn ? 'text-amber-500' : 'text-slate-400'
                      }`}>
                        [{line.level}]
                      </span>
                      <span className="text-slate-500 font-semibold shrink-0">[{line.source}]</span>
                      <span className={isErr ? 'text-rose-300 font-semibold' : 'text-slate-300'}>{line.message}</span>
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

        </div>
      </div>

      {/* 3. AI INVESTIGATION BOARD (Telemetry Analysis Panel Right) */}
      <div className="col-span-4 flex flex-col overflow-y-auto space-y-4">
        
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
              
              <textarea
                value={responseDraft}
                onChange={(e) => setResponseDraft(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-slate-800 bg-slate-950/80 p-2.5 font-sans text-xxs text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />

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
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center space-x-4 rounded-xl border border-indigo-500/40 bg-slate-950/95 px-5 py-3.5 shadow-2xl shadow-black/80 backdrop-blur-xl"
          >
            <div className="flex items-center space-x-2 text-xxs font-mono text-indigo-400">
              <Icons.Inbox className="h-4 w-4 animate-bounce" />
              <span className="font-bold uppercase tracking-wider">{selectedIncidentIds.length} SELECTED</span>
            </div>

            <div className="h-5 w-[1px] bg-slate-800" />

            <div className="flex items-center space-x-2.5">
              {/* Assign to Me Button */}
              <button
                onClick={() => {
                  setIncidents(prev => prev.map(inc => 
                    selectedIncidentIds.includes(inc.id)
                      ? { ...inc, assignee: 'Eshan Barua' }
                      : inc
                  ));
                  onAddAuditLog(
                    "Eshan Barua (CTO)", 
                    "Batch Assign Tickets", 
                    "Operational Workspace", 
                    "SUCCESS", 
                    `Assigned selected incidents (${selectedIncidentIds.join(', ')}) to operator: Eshan Barua`
                  );
                  window.dispatchEvent(new CustomEvent('show-toast', { 
                    detail: { message: `Successfully assigned ${selectedIncidentIds.length} tickets to you.` } 
                  }));
                  setSelectedIncidentIds([]);
                }}
                className="flex items-center space-x-1.5 rounded-lg bg-indigo-600/10 border border-indigo-500/20 hover:bg-indigo-600/25 px-3 py-1.5 text-xxs font-bold text-indigo-400 cursor-pointer transition-all"
              >
                <Icons.UserPlus className="h-3.5 w-3.5" />
                <span>Assign to Me</span>
              </button>

              {/* Resolve All Button */}
              <button
                onClick={() => {
                  setIncidents(prev => prev.map(inc => 
                    selectedIncidentIds.includes(inc.id)
                      ? { ...inc, status: 'SOLVED', csatScore: 94 }
                      : inc
                  ));
                  onAddAuditLog(
                    "Eshan Barua (CTO)", 
                    "Batch Resolve Tickets", 
                    "Operational Workspace", 
                    "SUCCESS", 
                    `Resolved selected incidents (${selectedIncidentIds.join(', ')}) via batch resolution execution.`
                  );
                  window.dispatchEvent(new CustomEvent('show-toast', { 
                    detail: { message: `Resolved ${selectedIncidentIds.length} selected tickets successfully.` } 
                  }));
                  setSelectedIncidentIds([]);
                }}
                className="flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xxs font-bold text-white hover:bg-emerald-500 cursor-pointer transition-all shadow-lg shadow-emerald-600/10"
              >
                <Icons.CheckCircle className="h-3.5 w-3.5" />
                <span>Resolve Selected</span>
              </button>

              {/* Cancel Selection */}
              <button
                onClick={() => setSelectedIncidentIds([])}
                className="rounded-lg border border-slate-800 bg-slate-900/50 hover:bg-slate-800 hover:border-slate-700 px-2.5 py-1.5 text-xxs font-medium text-slate-400 hover:text-white cursor-pointer transition-all"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

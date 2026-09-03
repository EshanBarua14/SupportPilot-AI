import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as Icons from 'lucide-react';

interface CodeFile {
  name: string;
  path: string;
  project: 'Domain' | 'Application' | 'Infrastructure' | 'API' | 'Solution';
}

export default function AspNetConsole() {
  // Active sub-panels
  const [activeSubTab, setActiveSubTab] = useState<'architecture' | 'identity' | 'cqrs' | 'signalr'>('architecture');

  // File explorer states
  const [selectedFile, setSelectedFile] = useState<CodeFile | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState<boolean>(false);

  // Authentication & Token claims states
  const [loginEmail, setLoginEmail] = useState<string>('admin@supportpilot.ai');
  const [selectedTenant, setSelectedTenant] = useState<string>('11111111-1111-1111-1111-111111111111');
  const [jwtToken, setJwtToken] = useState<string>('');
  const [decodedClaims, setDecodedClaims] = useState<any>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // CQRS and database simulator states
  const [dbSchema, setDbSchema] = useState<any>(null);
  const [loadingSchema, setLoadingSchema] = useState<boolean>(false);
  const [tenantIncidents, setTenantIncidents] = useState<any[]>([]);
  const [tenantAudits, setTenantAudits] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  
  // Create incident command payload
  const [newIncTitle, setNewIncTitle] = useState<string>('Memory starvation warning in checkout pod-2a');
  const [newIncAppName, setNewIncAppName] = useState<string>('PCI Checkout Gateway');
  const [newIncSeverity, setNewIncSeverity] = useState<string>('HIGH');
  const [newIncSource, setNewIncSource] = useState<string>('Slack');
  const [commandLog, setCommandLog] = useState<string[]>([]);

  // SignalR states
  const [signalrEvents, setSignalrEvents] = useState<string[]>([]);
  const [logSeverityFilter, setLogSeverityFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');
  const [isRowHighlightEnabled, setIsRowHighlightEnabled] = useState<boolean>(true);

  const getLogSeverity = (evt: string): 'INFO' | 'WARN' | 'ERROR' => {
    const lower = evt.toLowerCase();
    if (
      lower.includes('[security risk alert]') ||
      lower.includes('exception') ||
      lower.includes('error') ||
      lower.includes('failed') ||
      lower.includes('blocked') ||
      lower.includes('insufficient') ||
      lower.includes('oomkilled') ||
      lower.includes('exit code 137')
    ) {
      return 'ERROR';
    }
    if (
      lower.includes('[signalr alert]') ||
      lower.includes('warn') ||
      lower.includes('warning') ||
      lower.includes('contention') ||
      lower.includes('degraded') ||
      lower.includes('waiting') ||
      lower.includes('stalling') ||
      lower.includes('timeout')
    ) {
      return 'WARN';
    }
    return 'INFO';
  };

  const filteredSignalrEvents = signalrEvents.filter(evt => {
    if (logSeverityFilter === 'ALL') return true;
    return getLogSeverity(evt) === logSeverityFilter;
  });

  const [customAlertMsg, setCustomAlertMsg] = useState<string>('CPU consumption exceeded 90% limit in billing cluster-14');
  const [broadcastTargetTenant, setBroadcastTargetTenant] = useState<string>('11111111-1111-1111-1111-111111111111');
  const signalrEndRef = useRef<HTMLDivElement>(null);

  const backendFiles: CodeFile[] = [
    { name: "Program.cs", path: "SupportPilot.API/Program.cs", project: "API" },
    { name: "AuthController.cs", path: "SupportPilot.API/Controllers/AuthController.cs", project: "API" },
    { name: "IncidentsController.cs", path: "SupportPilot.API/Controllers/IncidentsController.cs", project: "API" },
    { name: "IncidentHub.cs", path: "SupportPilot.Infrastructure/Hubs/IncidentHub.cs", project: "Infrastructure" },
    { name: "JwtService.cs", path: "SupportPilot.Infrastructure/Security/JwtService.cs", project: "Infrastructure" },
    { name: "TenantMiddleware.cs", path: "SupportPilot.Infrastructure/Security/TenantMiddleware.cs", project: "Infrastructure" },
    { name: "ApplicationDbContext.cs", path: "SupportPilot.Infrastructure/Persistence/ApplicationDbContext.cs", project: "Infrastructure" },
    { name: "ITenantContext.cs", path: "SupportPilot.Application/Common/Security/TenantContext.cs", project: "Application" },
    { name: "IApplicationDbContext.cs", path: "SupportPilot.Application/Common/Interfaces/IApplicationDbContext.cs", project: "Application" },
    { name: "CreateIncidentCommand.cs", path: "SupportPilot.Application/Incidents/Commands/CreateIncidentCommand.cs", project: "Application" },
    { name: "ResolveIncidentCommand.cs", path: "SupportPilot.Application/Incidents/Commands/ResolveIncidentCommand.cs", project: "Application" },
    { name: "GetIncidentsQuery.cs", path: "SupportPilot.Application/Incidents/Queries/GetIncidentsQuery.cs", project: "Application" },
    { name: "GetIncidentByIdQuery.cs", path: "SupportPilot.Application/Incidents/Queries/GetIncidentByIdQuery.cs", project: "Application" },
    { name: "Organization.cs", path: "SupportPilot.Domain/Entities/Organization.cs", project: "Domain" },
    { name: "User.cs", path: "SupportPilot.Domain/Entities/User.cs", project: "Domain" },
    { name: "Incident.cs", path: "SupportPilot.Domain/Entities/Incident.cs", project: "Domain" },
    { name: "AuditLog.cs", path: "SupportPilot.Domain/Entities/AuditLog.cs", project: "Domain" },
    { name: "README.md", path: "README.md", project: "Solution" }
  ];

  const tenantsList = [
    { id: "11111111-1111-1111-1111-111111111111", name: "Acme Billing Services", tier: "ENTERPRISE", app: "Billing Core" },
    { id: "22222222-2222-2222-2222-222222222222", name: "Fintech Pay Gateway", tier: "ENTERPRISE", app: "PCI Checkout Gateway" },
    { id: "33333333-3333-3333-3333-333333333333", name: "Global Logistics Network", tier: "PREMIUM", app: "External Webhooks Relay" }
  ];

  // Load initial files or defaults
  useEffect(() => {
    if (!selectedFile) {
      handleSelectFile(backendFiles[0]);
    }
    fetchDbSchema();
    handleFetchSignalrLogs();
  }, []);

  // Poll for SignalR event log updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeSubTab === 'signalr') {
        handleFetchSignalrLogs();
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [activeSubTab]);

  useEffect(() => {
    if (signalrEndRef.current) {
      signalrEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [signalrEvents]);

  // Synchronize database records based on selected JWT claims
  useEffect(() => {
    if (jwtToken) {
      fetchTenantData();
    }
  }, [jwtToken]);

  const handleSelectFile = async (file: CodeFile) => {
    setSelectedFile(file);
    setLoadingFile(true);
    try {
      const response = await fetch(`/api/aspnet/file-content?relativePath=${encodeURIComponent(file.path)}`);
      const data = await response.json();
      if (data.content) {
        setFileContent(data.content);
      } else {
        setFileContent(`// Error: File could not be loaded.\n// Path: ${file.path}`);
      }
    } catch (e) {
      setFileContent(`// Network exception while pulling file:\n// ${file.path}`);
    } finally {
      setLoadingFile(false);
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const response = await fetch('/api/aspnet/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, selectedTenantId: selectedTenant })
      });
      const data = await response.json();
      if (data.token) {
        setJwtToken(data.token);
        
        // Parse simulated claims safely handling base64url padding
        const payloadBase64 = data.token.split('.')[1];
        const normalized = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
        const pad = normalized.length % 4;
        const padded = pad ? normalized + '='.repeat(4 - pad) : normalized;
        const decoded = JSON.parse(decodeURIComponent(escape(atob(padded))));
        setDecodedClaims(decoded);
        
        addCommandLog(`SUCCESS: JWT Bearer Token issued for tenant context: ${decoded.TenantName}`);
      }
    } catch (error) {
      addCommandLog("ERROR: Authentication request failed.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const fetchTenantData = async () => {
    if (!jwtToken) return;
    setLoadingData(true);
    try {
      // Pull isolated incidents
      const incRes = await fetch('/api/aspnet/incidents', {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      const incData = await incRes.json();
      setTenantIncidents(Array.isArray(incData) ? incData : []);

      // Pull isolated audit logs
      const audRes = await fetch('/api/aspnet/audit-logs', {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      const audData = await audRes.json();
      setTenantAudits(Array.isArray(audData) ? audData : []);
    } catch (e) {
      addCommandLog("ERROR: Tenant isolated database retrieval failed.");
    } finally {
      setLoadingData(false);
    }
  };

  const fetchDbSchema = async () => {
    setLoadingSchema(true);
    try {
      const res = await fetch('/api/aspnet/db-schema');
      const data = await res.json();
      setDbSchema(data);
    } catch (e) {
      // Ignored
    } finally {
      setLoadingSchema(false);
    }
  };

  const handleFetchSignalrLogs = async () => {
    try {
      const res = await fetch('/api/aspnet/signalr-logs');
      const logs = await res.json();
      setSignalrEvents(logs);
    } catch (e) {
      // Ignored
    }
  };

  const handleTriggerCreateIncidentCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jwtToken) {
      addCommandLog("ERROR: Command execution blocked. Authenticated JWT token context is required to execute CQRS commands.");
      return;
    }

    addCommandLog(`[MediatR Dispatcher] Sending CreateIncidentCommand to Application pipeline...`);
    
    try {
      const res = await fetch('/api/aspnet/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify({
          title: newIncTitle,
          description: "Outage triggered and diagnosed over isolated tenant workspace.",
          appName: newIncAppName,
          severity: newIncSeverity,
          source: newIncSource,
          customerName: "Automated Sandbox Probe"
        })
      });

      if (res.status === 403) {
        addCommandLog(`FATAL: MediatR Pipeline Authorization Exception. Role ${decodedClaims?.role} lacks write-access privileges.`);
        alert("Authorization Failed: Read-Only operators are blocked from spawning incidents (RBAC assertion validation succeeded!)");
        return;
      }

      const data = await res.json();
      if (data.id) {
        addCommandLog(`SUCCESS: CreateIncidentCommand committed to Postgres. Row ID: ${data.id}`);
        setNewIncTitle('');
        fetchTenantData();
        handleFetchSignalrLogs();
      }
    } catch (err) {
      addCommandLog("ERROR: Failed to run CreateIncidentCommand.");
    }
  };

  const handleResolveIncidentCommand = async (id: string) => {
    if (!jwtToken) return;
    addCommandLog(`[MediatR Dispatcher] Sending ResolveIncidentCommand for ID: ${id}`);
    
    try {
      const res = await fetch(`/api/aspnet/incidents/${id}/resolve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        }
      });
      const data = await res.json();
      if (data.success) {
        addCommandLog(`SUCCESS: Incident ${id} status updated to SOLVED.`);
        fetchTenantData();
        handleFetchSignalrLogs();
      }
    } catch (err) {
      addCommandLog("ERROR: Resolve command execution failed.");
    }
  };

  const handleSignalrBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/aspnet/signalr-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: broadcastTargetTenant,
          message: customAlertMsg
        })
      });
      const data = await res.json();
      if (data.success) {
        setCustomAlertMsg('');
        handleFetchSignalrLogs();
        // Give quick feedback
        addCommandLog(`SignalR broadcast dispatched over web sockets to tenant group.`);
      }
    } catch (err) {
      // Ignored
    }
  };

  const addCommandLog = (log: string) => {
    setCommandLog(prev => [`[${new Date().toLocaleTimeString()}] ${log}`, ...prev.slice(0, 49)]);
  };

  const getProjectBgColor = (project: string) => {
    switch (project) {
      case 'Domain': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'Application': return 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
      case 'Infrastructure': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'API': return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* HEADER ROW */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <Icons.Server className="h-5 w-5 text-indigo-400" />
            <span>ASP.NET Core 9 Clean Architecture Engine</span>
          </h1>
          <p className="text-xxs text-slate-400 mt-1">
            Enterprise backend structure with decoupled CQRS layers, SignalR events, JWT token authentication, and multi-tenant isolation guard rails.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center space-x-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800 self-start">
          <button
            onClick={() => setActiveSubTab('architecture')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xxs transition-all ${
              activeSubTab === 'architecture' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Icons.FolderTree className="h-3.5 w-3.5" />
            <span>C# Clean Architecture Code</span>
          </button>
          <button
            onClick={() => setActiveSubTab('identity')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xxs transition-all ${
              activeSubTab === 'identity' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Icons.Key className="h-3.5 w-3.5" />
            <span>JWT Claims Inspector</span>
          </button>
          <button
            onClick={() => setActiveSubTab('cqrs')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xxs transition-all ${
              activeSubTab === 'cqrs' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Icons.Terminal className="h-3.5 w-3.5" />
            <span>CQRS Sandbox DB</span>
          </button>
          <button
            onClick={() => setActiveSubTab('signalr')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xxs transition-all ${
              activeSubTab === 'signalr' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Icons.Radio className="h-3.5 w-3.5" />
            <span>SignalR Stream</span>
          </button>
        </div>
      </div>

      {/* CORE VIEW PORTS */}
      <div className="flex-1 min-h-0">
        <AnimatePresence mode="wait">
          
          {/* VIEW 1: CLEAN ARCHITECTURE CODE EXPLORER */}
          {activeSubTab === 'architecture' && (
            <motion.div
              key="arch"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full min-h-0"
            >
              {/* Directory Sidebar */}
              <div className="lg:col-span-1 bg-slate-900/30 border border-slate-900/80 rounded-2xl p-4 flex flex-col min-h-0 space-y-3">
                <div className="flex items-center justify-between text-xs text-white font-bold border-b border-slate-900 pb-2">
                  <span className="flex items-center space-x-2">
                    <Icons.Briefcase className="h-4 w-4 text-slate-400" />
                    <span>SupportPilot.sln</span>
                  </span>
                  <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded font-mono">.NET 9</span>
                </div>

                {/* Groups */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  {['Domain', 'Application', 'Infrastructure', 'API', 'Solution'].map(proj => {
                    const files = backendFiles.filter(f => f.project === proj);
                    return (
                      <div key={proj} className="space-y-1">
                        <div className="flex items-center space-x-1.5 text-xxs font-bold text-slate-500 uppercase tracking-wider px-2">
                          <Icons.ChevronDown className="h-3 w-3" />
                          <span>{proj} Project</span>
                        </div>
                        <div className="space-y-0.5">
                          {files.map(file => (
                            <button
                              key={file.path}
                              onClick={() => handleSelectFile(file)}
                              className={`w-full flex items-center justify-between text-left text-xs px-3 py-1.5 rounded-lg transition-colors ${
                                selectedFile?.path === file.path
                                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 font-semibold'
                                  : 'text-slate-400 hover:bg-slate-900/40 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center space-x-2 truncate">
                                <Icons.FileCode className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{file.name}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Code Editor Screen */}
              <div className="lg:col-span-3 bg-slate-950 border border-slate-900 rounded-2xl flex flex-col min-h-0">
                <div className="flex h-11 items-center justify-between border-b border-slate-900 px-4 bg-slate-900/20">
                  <div className="flex items-center space-x-3.5">
                    <div className="flex space-x-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500/40" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500/40" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/40" />
                    </div>
                    {selectedFile && (
                      <div className="flex items-center space-x-2 text-xxs font-mono">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${getProjectBgColor(selectedFile.project)}`}>
                          {selectedFile.project}
                        </span>
                        <span className="text-slate-400 font-semibold">{selectedFile.path}</span>
                      </div>
                    )}
                  </div>
                  
                  {selectedFile && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      C# Code File • Read Only
                    </span>
                  )}
                </div>

                <div className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-300 leading-relaxed bg-slate-950/95 relative">
                  {loadingFile ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70">
                      <div className="flex items-center space-x-3 text-slate-400 text-xs">
                        <Icons.Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                        <span>Compiling architecture code cache...</span>
                      </div>
                    </div>
                  ) : (
                    <pre className="whitespace-pre overflow-x-auto selection:bg-indigo-600/30 text-slate-300">
                      {fileContent}
                    </pre>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* VIEW 2: JWT CLAIMS INSPECTOR */}
          {activeSubTab === 'identity' && (
            <motion.div
              key="identity"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-0 overflow-y-auto"
            >
              {/* Form Configurer */}
              <div className="lg:col-span-5 bg-slate-900/30 border border-slate-900/80 rounded-2xl p-6 flex flex-col space-y-4">
                <div className="flex items-center space-x-2 text-xs text-indigo-400 font-bold uppercase tracking-wider border-b border-slate-900 pb-2">
                  <Icons.Key className="h-4 w-4" />
                  <span>C# JWT Authentication Parameters</span>
                </div>

                <div className="space-y-4 text-xxs">
                  {/* Select Tenant */}
                  <div className="space-y-1.5">
                    <label className="block text-slate-400 font-semibold font-display">Target Tenant Boundary</label>
                    <select
                      value={selectedTenant}
                      onChange={(e) => setSelectedTenant(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-slate-200 outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                    >
                      {tenantsList.map(t => (
                        <option key={t.id} value={t.id}>{t.name} (SLA: {t.tier})</option>
                      ))}
                    </select>
                  </div>

                  {/* Operator Mail */}
                  <div className="space-y-1.5">
                    <label className="block text-slate-400 font-semibold font-display">Operator Email Credentials</label>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-slate-200 outline-none focus:border-indigo-500 font-mono transition-colors"
                      placeholder="admin@supportpilot.ai"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <button
                        onClick={() => setLoginEmail('admin@supportpilot.ai')}
                        className="px-2 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 font-mono text-[9px]"
                      >
                        admin_role
                      </button>
                      <button
                        onClick={() => setLoginEmail('ajenkins.l1@acme.com')}
                        className="px-2 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 font-mono text-[9px]"
                      >
                        l1_engineer
                      </button>
                      <button
                        onClick={() => setLoginEmail('dkim.l2@fintechpay.global')}
                        className="px-2 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 font-mono text-[9px]"
                      >
                        l2_engineer
                      </button>
                      <button
                        onClick={() => setLoginEmail('auditor.read@logistics.co')}
                        className="px-2 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 font-mono text-[9px]"
                      >
                        read_only
                      </button>
                    </div>
                  </div>

                  {/* Generate Button */}
                  <button
                    onClick={handleLogin}
                    disabled={isLoggingIn}
                    className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-lg shadow-indigo-600/15 disabled:opacity-50 text-xs"
                  >
                    {isLoggingIn ? (
                      <Icons.Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icons.Unlock className="h-4 w-4" />
                    )}
                    <span>Authorize & Generate JWT Bearer Token</span>
                  </button>
                </div>
              </div>

              {/* JWT Claims Token Viewer */}
              <div className="lg:col-span-7 flex flex-col space-y-4">
                <div className="bg-slate-950 border border-slate-900 rounded-2xl p-5 flex flex-col space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                    <span className="text-xs text-white font-bold flex items-center space-x-1.5 font-display">
                      <Icons.ShieldAlert className="h-4 w-4 text-indigo-400" />
                      <span>Decoded JWT Token Payload</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Issuer: supportpilot.ai</span>
                  </div>

                  {decodedClaims ? (
                    <div className="space-y-3">
                      {/* Claims Table */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-900 text-xxs">
                          <span className="text-slate-500 font-mono block">TenantId claim</span>
                          <span className="text-emerald-400 font-bold font-mono block truncate mt-1">{decodedClaims.TenantId}</span>
                        </div>
                        <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-900 text-xxs">
                          <span className="text-slate-500 font-mono block">Operator Role claim</span>
                          <span className="text-indigo-400 font-bold font-mono block mt-1">{decodedClaims.role}</span>
                        </div>
                        <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-900 text-xxs">
                          <span className="text-slate-500 font-mono block">Expiration timestamp</span>
                          <span className="text-slate-300 font-mono block mt-1">{new Date(decodedClaims.exp * 1000).toLocaleTimeString()}</span>
                        </div>
                      </div>

                      <div className="bg-slate-900/20 p-4 rounded-xl border border-slate-900 text-xxs font-mono space-y-1 text-slate-400">
                        <div><span className="text-purple-400">"sub"</span>: "{decodedClaims.sub}",</div>
                        <div><span className="text-purple-400">"TenantName"</span>: "{decodedClaims.TenantName}",</div>
                        <div><span className="text-purple-400">"jti"</span>: "{decodedClaims.jti}",</div>
                        <div><span className="text-purple-400">"aud"</span>: "supportpilot-clients"</div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-28 flex flex-col items-center justify-center text-slate-500 text-xxs bg-slate-900/10 rounded-xl border border-dashed border-slate-800 p-4">
                      <Icons.KeyRound className="h-6 w-6 mb-2 text-slate-600" />
                      <span>Authorize user details to generate the security claims profile.</span>
                    </div>
                  )}
                </div>

                {/* Raw token string */}
                {jwtToken && (
                  <div className="bg-slate-950 border border-slate-900 rounded-2xl p-4">
                    <span className="text-[10px] text-slate-500 font-mono block uppercase tracking-wider mb-1.5 font-bold">Raw Token (Bearer Signature)</span>
                    <div className="rounded-xl bg-slate-900/50 p-3 font-mono text-[9px] text-slate-400 select-all break-all border border-slate-900">
                      {jwtToken}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* VIEW 3: CQRS SANDBOX DATABASE */}
          {activeSubTab === 'cqrs' && (
            <motion.div
              key="cqrs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-0 overflow-y-auto"
            >
              {/* Tenant context banner if not logged in */}
              {!jwtToken && (
                <div className="lg:col-span-12 bg-indigo-900/10 border border-indigo-500/20 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="bg-indigo-600/20 text-indigo-400 p-2.5 rounded-xl border border-indigo-500/30">
                      <Icons.AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white font-display">No Authenticated JWT Session Active</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">Please authorize under the "JWT Claims Inspector" tab first to retrieve tenant isolated database records.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveSubTab('identity')}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xxs transition-all shadow-lg"
                  >
                    Go to Claims Authenticator
                  </button>
                </div>
              )}

              {jwtToken && (
                <>
                  {/* Left block: Form Command Dispatcher */}
                  <div className="lg:col-span-4 bg-slate-900/30 border border-slate-900/80 rounded-2xl p-5 flex flex-col space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                      <span className="text-xs text-white font-bold flex items-center space-x-1.5 uppercase font-display tracking-wider">
                        <Icons.Compass className="h-4 w-4 text-indigo-400" />
                        <span>CQRS Command Center</span>
                      </span>
                      <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold font-mono px-1.5 py-0.5 rounded">MediatR</span>
                    </div>

                    <form onSubmit={handleTriggerCreateIncidentCommand} className="space-y-3.5 text-xxs">
                      <div className="space-y-1">
                        <label className="text-slate-400 font-semibold block">Command Request Type</label>
                        <div className="p-2.5 rounded-xl bg-slate-950 font-mono text-[9px] border border-slate-800 text-indigo-300">
                          SupportPilot.Application.Incidents.Commands.CreateIncidentCommand
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-slate-400 font-semibold block">Incident Outage Title</label>
                        <input
                          type="text"
                          required
                          value={newIncTitle}
                          onChange={(e) => setNewIncTitle(e.target.value)}
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-slate-200 outline-none focus:border-indigo-500 font-mono"
                          placeholder="e.g. Memory threshold breached on dispatcher-pod"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-slate-400 font-semibold block">Microservice App</label>
                          <select
                            value={newIncAppName}
                            onChange={(e) => setNewIncAppName(e.target.value)}
                            className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2 text-slate-200 cursor-pointer"
                          >
                            <option value="Billing Core">Billing Core</option>
                            <option value="PCI Checkout Gateway">PCI Checkout</option>
                            <option value="External Webhooks Relay">Webhook Relay</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-400 font-semibold block">Severity</label>
                          <select
                            value={newIncSeverity}
                            onChange={(e) => setNewIncSeverity(e.target.value)}
                            className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2 text-slate-200 cursor-pointer"
                          >
                            <option value="CRITICAL">CRITICAL</option>
                            <option value="HIGH">HIGH</option>
                            <option value="MEDIUM">MEDIUM</option>
                            <option value="LOW">LOW</option>
                          </select>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-lg shadow-indigo-600/15 flex items-center justify-center space-x-1.5"
                      >
                        <Icons.Send className="h-3 w-3" />
                        <span>Dispatch CreateIncidentCommand</span>
                      </button>
                    </form>

                    {/* Operational log console */}
                    <div className="flex-1 min-h-[140px] max-h-[220px] bg-slate-950 border border-slate-900 rounded-xl p-3 flex flex-col min-h-0 space-y-1.5">
                      <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wider">MediatR Command Execution Trail</span>
                      <div className="flex-1 overflow-y-auto font-mono text-[9px] text-slate-400 space-y-1.5 pr-1 select-text">
                        {commandLog.length === 0 ? (
                          <div className="text-slate-600 h-full flex items-center justify-center">
                            Console idle. Fire commands to see stack log.
                          </div>
                        ) : (
                          commandLog.map((log, idx) => (
                            <div key={idx} className={log.includes('SUCCESS') ? 'text-emerald-400' : log.includes('ERROR') || log.includes('FATAL') ? 'text-rose-400' : 'text-slate-400'}>
                              {log}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right block: Database Query and Isolations */}
                  <div className="lg:col-span-8 flex flex-col space-y-4">
                    {/* Active query panel */}
                    <div className="bg-slate-950 border border-slate-900 rounded-2xl p-5 flex flex-col">
                      <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-4">
                        <div className="flex items-center space-x-2">
                          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-xs text-white font-bold font-display">
                            PostgreSQL Relational DB • Isolated Records of "{decodedClaims?.TenantName}"
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-500">TenantID Context: {decodedClaims?.TenantId}</span>
                      </div>

                      <div className="space-y-4">
                        {/* SQL block generated */}
                        <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-3 font-mono text-[9px] space-y-1 text-indigo-400 select-text">
                          <div className="text-slate-500">// Entity Framework Core generated PostgreSQL SQL translation:</div>
                          <div>
                            <span className="text-purple-400">SELECT</span> inc."Id", inc."Title", inc."Severity", inc."Status", inc."AppName"
                          </div>
                          <div>
                            <span className="text-purple-400">FROM</span> "Incidents" <span className="text-purple-400">AS</span> inc
                          </div>
                          <div>
                            <span className="text-purple-400">WHERE</span> inc."OrganizationId" = <span className="text-amber-400">@tenantId_parameter_claims</span>
                          </div>
                          <div className="text-emerald-400 mt-1">
                            -- Executed GetIncidentsQuery in CQRS handler pipeline
                          </div>
                        </div>

                        {/* List output */}
                        {loadingData ? (
                          <div className="h-32 flex items-center justify-center text-slate-400 text-xxs">
                            <Icons.Loader2 className="h-4 w-4 animate-spin text-indigo-400 mr-2" />
                            <span>Quering isolated postgres datasets...</span>
                          </div>
                        ) : tenantIncidents.length === 0 ? (
                          <div className="h-24 flex items-center justify-center text-slate-600 text-xxs border border-dashed border-slate-900 rounded-xl">
                            No incident database records found under this isolated tenant scope.
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                            {tenantIncidents.map((inc: any) => (
                              <div key={inc.id} className="flex items-center justify-between bg-slate-900/20 p-3 rounded-xl border border-slate-900 text-xxs">
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-bold text-white font-display">{inc.title}</span>
                                    <span className={`px-1.5 py-0.2 rounded text-[8px] font-mono font-bold ${
                                      inc.severity === 'CRITICAL' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                    }`}>
                                      {inc.severity}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    ID: {inc.id} • App: {inc.appName} • Created: {new Date(inc.createdAt).toLocaleTimeString()}
                                  </div>
                                </div>

                                <div className="flex items-center space-x-2">
                                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono ${
                                    inc.status === 'SOLVED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse'
                                  }`}>
                                    {inc.status}
                                  </span>
                                  {inc.status === 'OPEN' && (
                                    <button
                                      onClick={() => handleResolveIncidentCommand(inc.id)}
                                      className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] transition-all"
                                    >
                                      Resolve
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Audit log viewer */}
                    <div className="bg-slate-950 border border-slate-900 rounded-2xl p-5">
                      <span className="text-xs text-white font-bold block mb-3 font-display">Isolated Immutable Audit Trail</span>
                      <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                        {tenantAudits.length === 0 ? (
                          <div className="text-slate-600 font-mono text-[10px] text-center py-4">
                            No logs captured inside this tenant transactional block.
                          </div>
                        ) : (
                          tenantAudits.map((aud: any) => (
                            <div key={aud.id} className="bg-slate-900/10 border border-slate-900/60 p-2 rounded-lg flex justify-between font-mono text-[9px] text-slate-400">
                              <div>
                                <span className="text-slate-500">[{new Date(aud.timestamp).toLocaleTimeString()}]</span>{' '}
                                <span className="text-indigo-400 font-bold">{aud.action}</span> • By {aud.operator}
                                <div className="text-slate-500 text-[8px] mt-0.5">{aud.payload}</div>
                              </div>
                              <span className="text-emerald-400 font-bold">{aud.status}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* VIEW 4: SIGNALR BROADCAST HUBS */}
          {activeSubTab === 'signalr' && (
            <motion.div
              key="signalr"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-0"
            >
              {/* Left Form: Alert Injector */}
              <div className="lg:col-span-5 bg-slate-900/30 border border-slate-900/80 rounded-2xl p-5 flex flex-col space-y-4">
                <div className="flex items-center space-x-2 text-xs text-indigo-400 font-bold uppercase tracking-wider border-b border-slate-900 pb-2">
                  <Icons.Radio className="h-4 w-4" />
                  <span>SignalR Real-Time Broadcaster</span>
                </div>

                <p className="text-xxs text-slate-400 leading-relaxed">
                  Test the active WebSocket channels by broadcasting simulated network outages and metric threshold alarms to isolated groups.
                </p>

                <form onSubmit={handleSignalrBroadcast} className="space-y-4 text-xxs">
                  <div className="space-y-1.5">
                    <label className="block text-slate-400 font-semibold font-display">Target Client Group (Tenant ID Filter)</label>
                    <select
                      value={broadcastTargetTenant}
                      onChange={(e) => setBroadcastTargetTenant(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-slate-200 outline-none"
                    >
                      {tenantsList.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-slate-400 font-semibold font-display">System Warning Alert Payload</label>
                    <textarea
                      required
                      value={customAlertMsg}
                      onChange={(e) => setCustomAlertMsg(e.target.value)}
                      className="w-full h-20 rounded-xl border border-slate-800 bg-slate-950 p-3 text-slate-200 outline-none font-mono"
                      placeholder="e.g. Memory pool leak detected in production cluster..."
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-lg flex items-center justify-center space-x-2"
                  >
                    <Icons.Radio className="h-4 w-4 text-white" />
                    <span>Broadcast SignalR Event</span>
                  </button>
                </form>
              </div>

              {/* Right Block: Live Log Console */}
              <div className="lg:col-span-7 bg-slate-950 border border-slate-900 rounded-2xl flex flex-col min-h-0">
                <div className="flex h-11 items-center justify-between border-b border-slate-900 px-4 bg-slate-900/20">
                  <div className="flex items-center space-x-2 text-xxs font-mono">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-slate-400 font-bold uppercase tracking-wider">Live Hub Streams [IncidentHub]</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Transport: WebSockets</span>
                </div>

                {/* LOG severity level filter and row-highlighting control toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900 px-4 py-2 bg-slate-900/10 text-[9px] font-mono select-none">
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-500 uppercase font-bold text-[8px]">Severity Filter:</span>
                    <div className="flex items-center bg-slate-950 border border-slate-900 rounded-lg p-0.5">
                      {(['ALL', 'INFO', 'WARN', 'ERROR'] as const).map((lvl) => (
                        <button
                          type="button"
                          key={lvl}
                          onClick={() => setLogSeverityFilter(lvl)}
                          className={`px-2 py-0.5 rounded text-[8px] font-bold transition-all cursor-pointer ${
                            logSeverityFilter === lvl
                              ? lvl === 'ERROR'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : lvl === 'WARN'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : lvl === 'INFO'
                                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                : 'bg-slate-800 text-white'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-slate-500 uppercase font-bold text-[8px]">Row Highlight:</span>
                    <button
                      type="button"
                      onClick={() => setIsRowHighlightEnabled(!isRowHighlightEnabled)}
                      className={`flex items-center space-x-1 px-2 py-0.5 rounded border transition-all cursor-pointer ${
                        isRowHighlightEnabled
                          ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                          : 'bg-slate-950 border-slate-900 text-slate-500 hover:text-slate-400'
                      }`}
                    >
                      {isRowHighlightEnabled ? (
                        <>
                          <Icons.Check className="h-3 w-3" />
                          <span>Enabled</span>
                        </>
                      ) : (
                        <>
                          <Icons.X className="h-3 w-3" />
                          <span>Disabled</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-4 font-mono text-[10px] text-slate-300 leading-relaxed bg-slate-950/95 space-y-2 select-text">
                  {filteredSignalrEvents.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-600 italic">
                      {signalrEvents.length === 0 ? "Connecting to ASP.NET Core SignalR stream..." : "No logs matching current severity filter."}
                    </div>
                  ) : (
                    filteredSignalrEvents.map((evt, idx) => {
                      const severity = getLogSeverity(evt);
                      let styleClass = '';
                      
                      if (isRowHighlightEnabled) {
                        if (severity === 'ERROR') {
                          styleClass = 'bg-rose-950/20 border-l-2 border-rose-500 text-rose-400 px-2 py-1 rounded';
                        } else if (severity === 'WARN') {
                          styleClass = 'bg-amber-950/20 border-l-2 border-amber-500 text-amber-400 px-2 py-1 rounded';
                        } else {
                          styleClass = 'bg-slate-900/40 border-l-2 border-indigo-500/60 text-slate-300 px-2 py-1 rounded';
                        }
                      } else {
                        // Standard coloring
                        if (evt.includes('[JWT AuthService]')) styleClass = 'text-sky-400';
                        else if (evt.includes('[MediatR CQRS]')) styleClass = 'text-indigo-400';
                        else if (evt.includes('[SignalR Broadcast]')) styleClass = 'text-emerald-400';
                        else if (evt.includes('[SignalR Alert]')) styleClass = 'text-rose-400 font-bold';
                        else if (evt.includes('[SECURITY RISK ALERT]')) styleClass = 'text-rose-500 font-bold bg-rose-500/10 px-1 py-0.5 rounded';
                        else styleClass = 'text-slate-400';
                      }

                      return (
                        <div key={idx} className={`${styleClass} leading-normal transition-all duration-150`}>
                          {evt}
                        </div>
                      );
                    })
                  )}
                  <div ref={signalrEndRef} />
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { ProjectMasterIndex } from '../MasterIndex';
import { AuditLogEntry } from '../types';
import * as Icons from 'lucide-react';

interface AuditPanelProps {
  auditLogs: AuditLogEntry[];
}

export default function AuditPanel({ auditLogs }: AuditPanelProps) {
  const masterIndex = ProjectMasterIndex;
  const [activeSubTab, setActiveSubTab] = useState<'audit' | 'master'>('audit');

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOperator, setFilterOperator] = useState('ALL');
  const [filterModule, setFilterModule] = useState('ALL');
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Extract unique values for filters
  const operators = ['ALL', ...Array.from(new Set(auditLogs.map(l => l.operator)))];
  const modules = ['ALL', ...Array.from(new Set(auditLogs.map(l => l.module)))];
  const actions = ['ALL', ...Array.from(new Set(auditLogs.map(l => l.action)))];

  // Filter logs logic
  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = 
      log.operator.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.payload.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesOperator = filterOperator === 'ALL' || log.operator === filterOperator;
    const matchesModule = filterModule === 'ALL' || log.module === filterModule;
    const matchesAction = filterAction === 'ALL' || log.action === filterAction;
    const matchesStatus = filterStatus === 'ALL' || log.status === filterStatus;

    return matchesSearch && matchesOperator && matchesModule && matchesAction && matchesStatus;
  }).sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime();
    const dateB = new Date(b.timestamp).getTime();
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  const clearFilters = () => {
    setSearchTerm('');
    setFilterOperator('ALL');
    setFilterModule('ALL');
    setFilterAction('ALL');
    setFilterStatus('ALL');
    setSortOrder('desc');
  };

  const handleDownloadCSV = () => {
    const headers = ['ID', 'Timestamp', 'Operator', 'Module', 'Action', 'Status', 'Payload'];
    const rows = filteredLogs.map(log => [
      log.id,
      log.timestamp,
      log.operator,
      log.module,
      log.action,
      log.status,
      `"${log.payload.replace(/"/g, '""')}"`
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `supportpilot_audit_export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex h-[calc(100vh-130px)] flex-col rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden text-xs font-sans">
      
      {/* Sub Tabs Toggle header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-4 py-2">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`px-3 py-1.5 font-display font-medium rounded-lg text-xxs transition-colors ${
              activeSubTab === 'audit' 
                ? 'bg-indigo-600 text-white font-bold' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            Immutable Security Audit Trails
          </button>
          <button
            onClick={() => setActiveSubTab('master')}
            className={`px-3 py-1.5 font-display font-medium rounded-lg text-xxs transition-colors ${
              activeSubTab === 'master' 
                ? 'bg-indigo-600 text-white font-bold' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            Platform Master Index (Live Spec)
          </button>
        </div>
        
        <div className="flex items-center space-x-1.5 font-mono text-[9px] text-slate-500 border border-slate-800 bg-slate-950 px-2 py-1 rounded">
          <Icons.Shield className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
          <span>SECURITY HARDENING: COMPLIANCE STATUS STABLE</span>
        </div>
      </div>

      {/* Panel View Content area */}
      <div className="flex-1 overflow-y-auto p-4 select-text">
        
        {/* TAB 1: IMMUTABLE AUDIT LOGS */}
        {activeSubTab === 'audit' && (
          <div className="space-y-4">
            <div className="rounded border border-dashed border-indigo-500/30 bg-indigo-500/5 p-4 text-slate-300 leading-relaxed">
              <span className="font-bold text-indigo-400 block mb-1">Electronic Ledger Compliance Trail</span>
              Every action taken within this SupportPilot AI console is logged securely inside our database cluster logs.
              This log satisfies PCI-DSS, SOC-2, and GDPR audit checks on PII containment and script bypasses.
            </div>

            {/* Advanced Filters Bar */}
            <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                <span className="text-xxs font-bold text-indigo-400 flex items-center space-x-1.5 font-display uppercase tracking-wider">
                  <Icons.SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Interactive Audit Query Filters</span>
                </span>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleDownloadCSV}
                    className="text-emerald-400 hover:text-emerald-300 text-[10px] font-mono font-bold flex items-center space-x-1 border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 rounded-md cursor-pointer transition-colors"
                  >
                    <Icons.Download className="h-3 w-3" />
                    <span>Download CSV</span>
                  </button>
                  <button
                    onClick={clearFilters}
                    className="text-slate-500 hover:text-white text-[10px] font-mono flex items-center space-x-1"
                  >
                    <Icons.RotateCcw className="h-3 w-3" />
                    <span>Reset Query</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
                {/* Search Term */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] text-slate-400 font-medium">Text Search</label>
                  <div className="relative">
                    <Icons.Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search operator, module, action..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950/90 text-slate-200 outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Operator Filter */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-medium">Operator</label>
                  <select
                    value={filterOperator}
                    onChange={(e) => setFilterOperator(e.target.value)}
                    className="w-full p-1.5 rounded-lg border border-slate-800 bg-slate-950/90 text-slate-200 cursor-pointer outline-none focus:border-indigo-500"
                  >
                    {operators.map(op => (
                      <option key={op} value={op}>{op === 'ALL' ? 'All Operators' : op.split('@')[0]}</option>
                    ))}
                  </select>
                </div>

                {/* Module Filter */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-medium">Module</label>
                  <select
                    value={filterModule}
                    onChange={(e) => setFilterModule(e.target.value)}
                    className="w-full p-1.5 rounded-lg border border-slate-800 bg-slate-950/90 text-slate-200 cursor-pointer outline-none focus:border-indigo-500"
                  >
                    {modules.map(mod => (
                      <option key={mod} value={mod}>{mod === 'ALL' ? 'All Modules' : mod}</option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-medium">Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full p-1.5 rounded-lg border border-slate-800 bg-slate-950/90 text-slate-200 cursor-pointer outline-none focus:border-indigo-500"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="SUCCESS">SUCCESS</option>
                    <option value="FAILED">FAILED</option>
                  </select>
                </div>

                {/* Sort Order Filter */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-medium">Sort Order</label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                    className="w-full p-1.5 rounded-lg border border-slate-800 bg-slate-950/90 text-slate-200 cursor-pointer outline-none focus:border-indigo-500"
                  >
                    <option value="desc">Newest First</option>
                    <option value="asc">Oldest First</option>
                  </select>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 font-mono pt-1">
                Showing <span className="text-indigo-400 font-bold">{filteredLogs.length}</span> of {auditLogs.length} ledger entries matching filters.
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/30">
              <table className="w-full text-left font-mono text-[10px]">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider text-xxs">
                    <th className="px-4 py-2.5">Timestamp</th>
                    <th className="px-4 py-2.5">Operator</th>
                    <th className="px-4 py-2.5">Module</th>
                    <th className="px-4 py-2.5">Action Executed</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/40">
                      <td className="px-4 py-3 text-slate-500 shrink-0 whitespace-nowrap">{log.timestamp.slice(0, 19).replace('T', ' ')}</td>
                      <td className="px-4 py-3 text-indigo-300 font-semibold">{log.operator}</td>
                      <td className="px-4 py-3 text-slate-400">{log.module}</td>
                      <td className="px-4 py-3 text-white font-bold">{log.action}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 font-bold ${
                          log.status === 'SUCCESS' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-xxs max-w-sm leading-relaxed">{log.payload}</td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500 font-sans">
                        No audit log entries matched the specified query parameters. Clear filters to start over.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: SYSTEM PLATFORM MASTER INDEX */}
        {activeSubTab === 'master' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            
            {/* Index Header statistics */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center">
                <div className="text-xxs font-mono text-slate-500 uppercase">SYSTEM COMPLETION</div>
                <div className="text-2xl font-black text-indigo-400 font-display mt-1">{masterIndex.completionPercent}%</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center">
                <div className="text-xxs font-mono text-slate-500 uppercase">APPLIED MIGRATIONS</div>
                <div className="text-2xl font-black text-emerald-400 font-display mt-1">{masterIndex.migrations.length} / {masterIndex.migrations.length}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center">
                <div className="text-xxs font-mono text-slate-500 uppercase">STABLE GATEWAY APIS</div>
                <div className="text-2xl font-black text-white font-display mt-1">{masterIndex.apis.length}</div>
              </div>
            </div>

            {/* Modules breakdown */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 space-y-3">
              <h4 className="font-display font-bold text-xs text-indigo-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                Active Modules Matrix
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {masterIndex.modules.map(m => (
                  <div key={m.name} className="rounded bg-slate-950/60 border border-slate-800 p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-white text-xxs">{m.name}</span>
                        <span className="rounded bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 font-mono text-[8px] uppercase font-bold border border-indigo-500/20">
                          {m.category}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">{m.description}</p>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between font-mono text-[9px] border-t border-slate-800 pt-2 text-slate-500">
                      <span>Status: <span className="text-emerald-400 font-bold">{m.status}</span></span>
                      <span>Progress: <span className="text-white">{m.progress}%</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Migrations breakdown */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 space-y-3">
              <h4 className="font-display font-bold text-xs text-indigo-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                Applied DB Schemas (Relational & Vector pgvector)
              </h4>
              <div className="space-y-1.5 font-mono text-[10px]">
                {masterIndex.migrations.map(m => (
                  <div key={m.version} className="flex items-center justify-between rounded bg-slate-950/40 border border-slate-800 px-3 py-2 text-slate-300">
                    <div className="flex items-center space-x-3">
                      <span className="text-slate-500">v{m.version}</span>
                      <span className="font-bold text-white">{m.name}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-slate-500">Applied: {m.executedAt}</span>
                      <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                        {m.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* APIs Gateway breakdown */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 space-y-3">
              <h4 className="font-display font-bold text-xs text-indigo-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                Server-Side API Gateway Endpoints
              </h4>
              <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                {masterIndex.apis.map(api => (
                  <div key={api.path} className="rounded bg-slate-950/40 border border-slate-800 p-2.5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`rounded px-1.5 py-0.5 font-bold text-[8px] ${
                          api.method === 'POST' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {api.method}
                        </span>
                        <span className="font-bold text-white text-xxs">{api.path}</span>
                      </div>
                      <p className="text-[9px] text-slate-500 mt-1 leading-snug font-sans">{api.description}</p>
                    </div>
                    <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[8px] font-bold text-emerald-400">
                      {api.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Technical debt notes and hazards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 space-y-2">
                <h4 className="font-display font-bold text-xs text-indigo-400 uppercase tracking-wider border-b border-slate-800 pb-1.5 flex items-center space-x-1.5">
                  <Icons.ZapOff className="h-4 w-4" />
                  <span>Technical Debt Log</span>
                </h4>
                <ul className="list-inside list-disc text-[10px] text-slate-300 space-y-1.5 pl-1 leading-relaxed">
                  {masterIndex.technicalDebt.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 space-y-2">
                <h4 className="font-display font-bold text-xs text-indigo-400 uppercase tracking-wider border-b border-slate-800 pb-1.5 flex items-center space-x-1.5">
                  <Icons.AlertTriangle className="h-4 w-4 text-amber-500 animate-pulse" />
                  <span>NOC Risks & Contingencies</span>
                </h4>
                <ul className="list-inside list-disc text-[10px] text-slate-300 space-y-1.5 pl-1 leading-relaxed">
                  {masterIndex.knownRisks.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}

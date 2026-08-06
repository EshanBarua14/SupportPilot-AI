import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';
import { Incident } from '../types';

interface BulkPdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIncidents: Incident[];
  onAddAuditLog?: (user: string, action: string, area: string, status: 'SUCCESS' | 'FAILED' | 'PENDING_APPROVAL', details: string) => void;
}

export function BulkPdfExportModal({
  isOpen,
  onClose,
  selectedIncidents,
  onAddAuditLog
}: BulkPdfExportModalProps) {
  const [includeLogs, setIncludeLogs] = useState(true);
  const [includeTimeline, setIncludeTimeline] = useState(true);
  const [reportTitle, setReportTitle] = useState('Consolidated Incident Incident Operations Summary');
  const [preparedBy, setPreparedBy] = useState('Eshan Barua (CTO / Incident Command)');

  if (!isOpen) return null;

  const totalIncidents = selectedIncidents.length;
  const criticalCount = selectedIncidents.filter(i => i.severity === 'CRITICAL').length;
  const highCount = selectedIncidents.filter(i => i.severity === 'HIGH').length;
  const solvedCount = selectedIncidents.filter(i => i.status === 'SOLVED').length;
  
  // Calculate top affected services
  const serviceCounts: Record<string, number> = {};
  selectedIncidents.forEach(i => {
    serviceCounts[i.appName] = (serviceCounts[i.appName] || 0) + 1;
  });
  const topServices = Object.entries(serviceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([svc, count]) => `${svc} (${count})`)
    .join(', ') || 'N/A';

  const handlePrint = () => {
    if (onAddAuditLog) {
      onAddAuditLog(
        preparedBy,
        'Bulk Export PDF Report Generated',
        'IncidentWorkspace',
        'SUCCESS',
        `Generated print-ready PDF consolidated summary report for ${totalIncidents} selected incident(s).`
      );
    }
    window.print();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            #printable-pdf-report, #printable-pdf-report * {
              visibility: visible;
            }
            #printable-pdf-report {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              background: #ffffff !important;
              color: #0f172a !important;
              padding: 20px !important;
              margin: 0 !important;
            }
            .no-print {
              display: none !important;
            }
            .print-border {
              border: 1px solid #cbd5e1 !important;
            }
            .print-bg-slate {
              background-color: #f8fafc !important;
            }
            .print-text-dark {
              color: #0f172a !important;
            }
          }
        `}} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-4xl max-h-[90vh] rounded-2xl border border-indigo-500/40 bg-slate-950 p-6 shadow-2xl relative flex flex-col font-sans"
        >
          {/* Header Controls (No Print) */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4 no-print">
            <div className="flex items-center space-x-3 text-indigo-400">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Icons.FileText className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-white flex items-center space-x-2">
                  <span>Bulk PDF Export & Print Report</span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-[10px] border border-indigo-500/30">
                    {totalIncidents} Incidents
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Consolidated print-ready executive operations summary
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handlePrint}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold font-mono transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                <Icons.Printer className="h-4 w-4" />
                <span>Print / Save as PDF</span>
              </button>

              <button
                onClick={onClose}
                className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <Icons.X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Config Controls (No Print) */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 mb-4 space-y-2 no-print font-mono text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Report Title</label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Prepared By</label>
                <input
                  type="text"
                  value={preparedBy}
                  onChange={(e) => setPreparedBy(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center space-x-6 pt-1">
              <label className="flex items-center space-x-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={includeLogs}
                  onChange={(e) => setIncludeLogs(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-600"
                />
                <span className="text-[11px]">Include Telemetry Logs</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={includeTimeline}
                  onChange={(e) => setIncludeTimeline(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-600"
                />
                <span className="text-[11px]">Include Investigation Root Causes</span>
              </label>
            </div>
          </div>

          {/* PRINTABLE REPORT CONTAINER */}
          <div
            id="printable-pdf-report"
            className="flex-1 overflow-y-auto pr-2 space-y-6 bg-slate-900/40 border border-slate-800 rounded-xl p-6 text-slate-200 font-sans print:bg-white print:text-slate-900"
          >
            {/* Document Header */}
            <div className="border-b border-slate-800 print:border-slate-300 pb-4 flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <div className="h-6 w-6 rounded bg-indigo-600 text-white flex items-center justify-center font-black text-xs font-mono">
                    SP
                  </div>
                  <span className="font-display font-extrabold text-lg text-white print:text-slate-900">SupportPilot Ops</span>
                </div>
                <h1 className="text-xl font-bold font-display text-indigo-400 print:text-indigo-950 mt-1">
                  {reportTitle}
                </h1>
                <p className="text-xs text-slate-400 print:text-slate-600 font-mono mt-0.5">
                  Generated on {new Date().toLocaleDateString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
                </p>
              </div>

              <div className="text-right font-mono text-xs space-y-0.5 text-slate-400 print:text-slate-600">
                <div>Prepared by: <span className="text-white print:text-slate-900 font-bold">{preparedBy}</span></div>
                <div>Scope: <span className="text-indigo-300 print:text-indigo-900 font-bold">{totalIncidents} Tickets</span></div>
                <div>Classification: <span className="text-rose-400 print:text-rose-700 font-bold uppercase">CONFIDENTIAL</span></div>
              </div>
            </div>

            {/* Executive Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-slate-950 print:bg-slate-100 border border-slate-800 print:border-slate-300 p-3">
                <span className="text-[10px] font-mono text-slate-400 print:text-slate-600 uppercase tracking-wider block">Total Incidents</span>
                <span className="text-xl font-bold font-mono text-white print:text-slate-900">{totalIncidents}</span>
              </div>

              <div className="rounded-xl bg-rose-950/30 print:bg-rose-50 border border-rose-500/30 print:border-rose-200 p-3">
                <span className="text-[10px] font-mono text-rose-300 print:text-rose-800 uppercase tracking-wider block">Critical (P0)</span>
                <span className="text-xl font-bold font-mono text-rose-400 print:text-rose-900">{criticalCount}</span>
              </div>

              <div className="rounded-xl bg-amber-950/30 print:bg-amber-50 border border-amber-500/30 print:border-amber-200 p-3">
                <span className="text-[10px] font-mono text-amber-300 print:text-amber-800 uppercase tracking-wider block">High Priority (P1)</span>
                <span className="text-xl font-bold font-mono text-amber-400 print:text-amber-900">{highCount}</span>
              </div>

              <div className="rounded-xl bg-emerald-950/30 print:bg-emerald-50 border border-emerald-500/30 print:border-emerald-200 p-3">
                <span className="text-[10px] font-mono text-emerald-300 print:text-emerald-800 uppercase tracking-wider block">Resolved Count</span>
                <span className="text-xl font-bold font-mono text-emerald-400 print:text-emerald-900">{solvedCount}</span>
              </div>
            </div>

            {/* Top Impacted Services */}
            <div className="rounded-xl bg-slate-950 print:bg-slate-50 border border-slate-800 print:border-slate-300 p-3 text-xs font-mono">
              <span className="text-slate-400 print:text-slate-600 font-bold uppercase text-[10px] block mb-1">Top Impacted Microservices:</span>
              <span className="text-indigo-300 print:text-indigo-900 font-bold">{topServices}</span>
            </div>

            {/* Detailed Table */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300 print:text-slate-800">
                Detailed Incident Ledger
              </h3>

              <div className="overflow-x-auto rounded-xl border border-slate-800 print:border-slate-300">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 print:bg-slate-200 text-slate-400 print:text-slate-700 font-mono text-[10px] uppercase border-b border-slate-800 print:border-slate-300">
                      <th className="p-2.5">ID</th>
                      <th className="p-2.5">Title</th>
                      <th className="p-2.5">Service</th>
                      <th className="p-2.5">Severity</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Assignee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 print:divide-slate-200 font-mono text-[11px]">
                    {selectedIncidents.map((inc) => (
                      <React.Fragment key={inc.id}>
                        <tr className="hover:bg-slate-900/50 print:hover:bg-slate-50 text-slate-200 print:text-slate-900">
                          <td className="p-2.5 font-bold text-indigo-400 print:text-indigo-700 whitespace-nowrap">{inc.id}</td>
                          <td className="p-2.5 font-sans font-semibold text-slate-100 print:text-slate-900 max-w-xs truncate">{inc.title}</td>
                          <td className="p-2.5 text-slate-300 print:text-slate-700 whitespace-nowrap">{inc.appName}</td>
                          <td className="p-2.5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${
                              inc.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 print:bg-rose-100 print:text-rose-800' :
                              inc.severity === 'HIGH' ? 'bg-amber-500/20 text-amber-300 print:bg-amber-100 print:text-amber-800' :
                              'bg-slate-800 text-slate-300 print:bg-slate-200 print:text-slate-800'
                            }`}>
                              {inc.severity}
                            </span>
                          </td>
                          <td className="p-2.5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${
                              inc.status === 'SOLVED' ? 'bg-emerald-500/20 text-emerald-300 print:bg-emerald-100 print:text-emerald-800' : 'bg-slate-800 text-slate-300 print:bg-slate-200 print:text-slate-800'
                            }`}>
                              {inc.status}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-300 print:text-slate-700 whitespace-nowrap">{inc.assignee || 'Unassigned'}</td>
                        </tr>

                        {includeTimeline && inc.analysis?.rootCause && (
                          <tr className="bg-slate-950/60 print:bg-slate-100/70 text-[10.5px]">
                            <td colSpan={6} className="p-2.5 pt-1 text-slate-400 print:text-slate-700 border-b border-slate-800/80 print:border-slate-300">
                              <span className="font-bold text-indigo-300 print:text-indigo-900 uppercase text-[9.5px]">Root Cause Signature: </span>
                              <span className="font-sans italic">{inc.analysis.rootCause}</span>
                            </td>
                          </tr>
                        )}

                        {includeLogs && inc.logs && inc.logs.length > 0 && (
                          <tr className="bg-slate-950 print:bg-slate-50 text-[10px]">
                            <td colSpan={6} className="p-2 font-mono text-slate-400 print:text-slate-600">
                              <span className="text-indigo-400 print:text-indigo-800 font-bold">Latest Log Snippet: </span>
                              <span>[{inc.logs[0].timestamp}] {inc.logs[0].message}</span>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Document Footer */}
            <div className="pt-4 border-t border-slate-800 print:border-slate-300 flex items-center justify-between text-[10px] font-mono text-slate-500 print:text-slate-600">
              <div>SupportPilot Autonomous Incident Operations Report</div>
              <div>Page 1 of 1</div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default BulkPdfExportModal;

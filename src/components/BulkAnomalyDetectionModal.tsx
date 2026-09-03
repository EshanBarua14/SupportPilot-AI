import React, { useState, useEffect } from 'react';
import { Incident } from '../types';
import * as Icons from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BulkAnomalyDetectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIncidents: Incident[];
  onAddAuditLog?: (user: string, action: string, area: string, status: 'SUCCESS' | 'FAILED' | 'PENDING_APPROVAL', details: string) => void;
  onRecordBulkHistory?: (type: string, description: string, count: number) => void;
}

interface TelemetryAnomaly {
  id: string;
  incidentId: string;
  title: string;
  metric: 'LATENCY' | 'ERROR_RATE' | 'CPU_SATURATION' | 'THREAD_POOL_EXHAUSTION' | 'MEMORY_LEAK';
  zScore: number;
  anomalyScore: number; // 0-100
  baselineValue: string;
  observedValue: string;
  service: string;
  isSystemicCluster: boolean;
  explanation: string;
}

export function BulkAnomalyDetectionModal({
  isOpen,
  onClose,
  selectedIncidents,
  onAddAuditLog,
  onRecordBulkHistory
}: BulkAnomalyDetectionModalProps) {
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(true);
  const [anomalies, setAnomalies] = useState<TelemetryAnomaly[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'CRITICAL_ANOMALIES' | 'SYSTEMIC_CLUSTERS'>('ALL');

  useEffect(() => {
    if (isOpen && selectedIncidents.length > 0) {
      runStatisticalAnalysis();
    }
  }, [isOpen, selectedIncidents]);

  const runStatisticalAnalysis = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      // Generate synthetic statistical anomaly detections based on selected incidents
      const generatedAnomalies: TelemetryAnomaly[] = selectedIncidents.flatMap((inc, index) => {
        const app = inc.appName || 'Core Infrastructure';
        const isCrit = inc.severity === 'CRITICAL';

        const list: TelemetryAnomaly[] = [
          {
            id: `anom-lat-${inc.id}`,
            incidentId: inc.id,
            title: inc.title,
            metric: 'LATENCY',
            zScore: isCrit ? +(3.8 + index * 0.4).toFixed(1) : +(2.4 + index * 0.2).toFixed(1),
            anomalyScore: isCrit ? 92 : 74,
            baselineValue: '120 ms (p95)',
            observedValue: isCrit ? '4,850 ms (p95)' : '1,890 ms (p95)',
            service: app,
            isSystemicCluster: isCrit || index % 2 === 0,
            explanation: `p95 response latency exceeded historical 30-day baseline by +${isCrit ? '3,900%' : '1,475%'}. Statistical Z-score indicates anomalous cluster.`
          },
          {
            id: `anom-err-${inc.id}`,
            incidentId: inc.id,
            title: inc.title,
            metric: 'ERROR_RATE',
            zScore: +(4.2 + (index % 3) * 0.5).toFixed(1),
            anomalyScore: 89,
            baselineValue: '0.02% 5xx',
            observedValue: '18.4% 5xx (HTTP 503/504)',
            service: app,
            isSystemicCluster: true,
            explanation: `HTTP 5xx rate spiked to 18.4% synchronously across worker nodes. Correlated with database socket pool exhaustion.`
          }
        ];

        if (isCrit) {
          list.push({
            id: `anom-cpu-${inc.id}`,
            incidentId: inc.id,
            title: inc.title,
            metric: 'CPU_SATURATION',
            zScore: 3.9,
            anomalyScore: 95,
            baselineValue: '34% avg',
            observedValue: '99.8% sustained',
            service: app,
            isSystemicCluster: true,
            explanation: `CPU core saturation pinned at 99.8% for > 15 mins. Indicates runaway recursive event loop or regex back-tracking.`
          });
        }

        return list;
      });

      setAnomalies(generatedAnomalies);
      setIsAnalyzing(false);

      if (onAddAuditLog) {
        onAddAuditLog(
          'Alex Vance (Admin)',
          'Bulk Telemetry Anomaly Detection',
          'Statistical Analytics Engine',
          'SUCCESS',
          `Ran z-score telemetry analysis across ${selectedIncidents.length} tickets. Identified ${generatedAnomalies.length} outliers (${generatedAnomalies.filter(a => a.isSystemicCluster).length} systemic clusters).`
        );
      }

      if (onRecordBulkHistory) {
        onRecordBulkHistory('ANOMALY_DETECTION', `Statistical analysis executed on ${selectedIncidents.length} incidents (${generatedAnomalies.length} anomalies detected)`, selectedIncidents.length);
      }
    }, 700);
  };

  if (!isOpen) return null;

  const totalAnomalies = anomalies.length;
  const systemicClusters = anomalies.filter(a => a.isSystemicCluster).length;
  const avgZScore = totalAnomalies > 0 ? (anomalies.reduce((a, b) => a + b.zScore, 0) / totalAnomalies).toFixed(1) : '0.0';

  const filteredAnomalies = anomalies.filter(a => {
    if (selectedFilter === 'CRITICAL_ANOMALIES') return a.anomalyScore >= 85;
    if (selectedFilter === 'SYSTEMIC_CLUSTERS') return a.isSystemicCluster;
    return true;
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-3xl rounded-2xl border border-purple-500/40 bg-slate-950 p-6 shadow-2xl space-y-5 font-mono relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-3 text-purple-400">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center shrink-0">
                <Icons.Activity className="h-5 w-5 text-purple-400 animate-pulse" />
              </div>
              <div>
                <h4 className="font-display font-bold text-sm text-white flex items-center space-x-2">
                  <span>Bulk Telemetry Anomaly & Statistical Outlier Engine</span>
                  <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-mono border border-purple-500/30 font-bold">
                    {selectedIncidents.length} Incident(s)
                  </span>
                </h4>
                <p className="text-[10px] text-slate-400">
                  Z-Score statistical telemetry profiling & shared metric anomaly correlation
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 border border-slate-800 bg-slate-900 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <Icons.X className="h-4 w-4" />
            </button>
          </div>

          {isAnalyzing ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Icons.RefreshCw className="h-8 w-8 text-purple-400 animate-spin" />
              <div className="text-xs text-purple-300 font-bold">Computing Z-Score Telemetry Deviations...</div>
              <div className="text-[10px] text-slate-500">Parsing log streams, CPU metrics, and p95 latency distributions</div>
            </div>
          ) : (
            <>
              {/* Summary Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-900/90 border border-purple-500/30 space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase font-bold">
                    <span>Total Outliers Found</span>
                    <Icons.AlertTriangle className="h-3.5 w-3.5 text-purple-400" />
                  </div>
                  <div className="text-xl font-extrabold text-purple-300">
                    {totalAnomalies} <span className="text-xs text-slate-400">anomalies</span>
                  </div>
                  <div className="text-[9px] text-slate-500">Extracted across telemetry log buffers</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/90 border border-rose-500/30 space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase font-bold">
                    <span>Systemic Clusters</span>
                    <Icons.Layers className="h-3.5 w-3.5 text-rose-400" />
                  </div>
                  <div className="text-xl font-extrabold text-rose-400">
                    {systemicClusters} <span className="text-xs text-slate-400">shared causes</span>
                  </div>
                  <div className="text-[9px] text-slate-500">Shared infrastructure dependency vectors</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase font-bold">
                    <span>Avg Z-Score Deviation</span>
                    <Icons.TrendingUp className="h-3.5 w-3.5 text-amber-400" />
                  </div>
                  <div className="text-xl font-extrabold text-amber-300">
                    +{avgZScore}σ <span className="text-xs text-amber-500">(high)</span>
                  </div>
                  <div className="text-[9px] text-slate-500">Standard deviation from baseline</div>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[10px]">
                  <button
                    onClick={() => setSelectedFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      selectedFilter === 'ALL' ? 'bg-purple-950 text-purple-200 border border-purple-500/40' : 'text-slate-400'
                    }`}
                  >
                    All Outliers ({totalAnomalies})
                  </button>
                  <button
                    onClick={() => setSelectedFilter('CRITICAL_ANOMALIES')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      selectedFilter === 'CRITICAL_ANOMALIES' ? 'bg-rose-950 text-rose-200 border border-rose-500/40' : 'text-slate-400'
                    }`}
                  >
                    Critical (&gt;85 score)
                  </button>
                  <button
                    onClick={() => setSelectedFilter('SYSTEMIC_CLUSTERS')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      selectedFilter === 'SYSTEMIC_CLUSTERS' ? 'bg-indigo-950 text-indigo-200 border border-indigo-500/40' : 'text-slate-400'
                    }`}
                  >
                    Systemic Clusters ({systemicClusters})
                  </button>
                </div>

                <button
                  onClick={runStatisticalAnalysis}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-purple-300 border border-slate-800 rounded-lg text-[10px] font-bold flex items-center space-x-1 cursor-pointer"
                >
                  <Icons.RefreshCw className="h-3 w-3" />
                  <span>Re-scan Logs</span>
                </button>
              </div>

              {/* Anomaly Outlier List */}
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {filteredAnomalies.map(anom => (
                  <div
                    key={anom.id}
                    className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-purple-500/40 transition-colors space-y-1.5 text-xs font-mono"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          anom.metric === 'LATENCY' ? 'bg-amber-950 text-amber-300 border border-amber-500/40' :
                          anom.metric === 'ERROR_RATE' ? 'bg-rose-950 text-rose-300 border border-rose-500/40' :
                          'bg-purple-950 text-purple-300 border border-purple-500/40'
                        }`}>
                          {anom.metric}
                        </span>
                        <span className="font-bold text-slate-200">{anom.incidentId}: {anom.title}</span>
                        <span className="text-[10px] text-slate-400">({anom.service})</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-rose-400 font-extrabold text-[11px]">+{anom.zScore}σ Z-Score</span>
                        {anom.isSystemicCluster && (
                          <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[8.5px] font-bold border border-rose-500/30">
                            SHARED SYSTEMIC
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-[10.5px] text-slate-300 leading-relaxed font-sans">{anom.explanation}</p>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[9.5px] text-slate-400">
                      <div>Baseline: <span className="text-slate-300">{anom.baselineValue}</span></div>
                      <div>Observed: <span className="text-rose-300 font-bold">{anom.observedValue}</span></div>
                      <div>Anomaly Score: <span className="text-purple-300 font-bold">{anom.anomalyScore}/100</span></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Footer */}
              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                <div className="text-[10px] text-slate-400 font-mono">
                  Analysis completed across <span className="text-purple-300 font-bold">{selectedIncidents.length} tickets</span>.
                </div>
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-purple-600/30"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default BulkAnomalyDetectionModal;

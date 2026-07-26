import React, { useMemo } from 'react';
import * as Icons from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { LogEntry } from '../types';

interface LogCorrelationChartProps {
  logs: LogEntry[];
  onSelectTimeBucket?: (timeLabel: string) => void;
}

export const LogCorrelationChart: React.FC<LogCorrelationChartProps> = ({ logs, onSelectTimeBucket }) => {
  const { chartData, metrics } = useMemo(() => {
    if (!logs || logs.length === 0) {
      return { chartData: [], metrics: { total: 0, errors: 0, warnings: 0, peakBucket: 'N/A', errorRatio: '0%' } };
    }

    // Bucket logs into minute-based intervals or 5 equal time slots
    const bucketMap = new Map<string, { time: string; errors: number; warnings: number; info: number; total: number }>();

    logs.forEach((log) => {
      let timeKey = '10:00';
      if (log.timestamp) {
        if (log.timestamp.includes('T')) {
          timeKey = log.timestamp.split('T')[1]?.slice(0, 5) || '10:00';
        } else if (log.timestamp.length >= 5) {
          timeKey = log.timestamp.slice(0, 5);
        }
      }

      if (!bucketMap.has(timeKey)) {
        bucketMap.set(timeKey, { time: timeKey, errors: 0, warnings: 0, info: 0, total: 0 });
      }

      const b = bucketMap.get(timeKey)!;
      b.total += 1;
      if (log.level === 'FATAL' || log.level === 'ERROR') {
        b.errors += 1;
      } else if (log.level === 'WARN') {
        b.warnings += 1;
      } else {
        b.info += 1;
      }
    });

    const chartData = Array.from(bucketMap.values()).sort((a, b) => a.time.localeCompare(b.time));

    let totalErrors = 0;
    let totalWarnings = 0;
    let peakBucket = 'N/A';
    let maxBucketErrors = -1;

    chartData.forEach(cd => {
      totalErrors += cd.errors;
      totalWarnings += cd.warnings;
      if (cd.errors > maxBucketErrors) {
        maxBucketErrors = cd.errors;
        peakBucket = cd.time;
      }
    });

    const errorRatio = ((totalErrors / logs.length) * 100).toFixed(1) + '%';

    return {
      chartData,
      metrics: {
        total: logs.length,
        errors: totalErrors,
        warnings: totalWarnings,
        peakBucket,
        errorRatio
      }
    };
  }, [logs]);

  return (
    <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 shadow-lg space-y-3 font-mono my-2">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-2.5">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400">
            <Icons.Activity className="h-3.5 w-3.5 animate-pulse" />
          </div>
          <div>
            <h4 className="font-display font-bold text-xs text-white uppercase tracking-wider">
              Log Error Frequency & Correlation Timeline
            </h4>
            <p className="text-[9px] text-slate-400">Linked dynamically to active log filters & search query</p>
          </div>
        </div>

        {/* Dynamic Summary Cards */}
        <div className="flex items-center space-x-2 text-xxs font-bold">
          <div className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
            <span>Filtered Stream: </span>
            <span className="text-indigo-400">{metrics.total} logs</span>
          </div>

          <div className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400">
            <span>Critical Errors: </span>
            <span>{metrics.errors} ({metrics.errorRatio})</span>
          </div>

          <div className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <span>Peak Error Spike: </span>
            <span>{metrics.peakBucket}</span>
          </div>
        </div>
      </div>

      {/* Recharts Area Visualization */}
      <div className="h-40 w-full pt-1">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-xxs">
            No matching log entries for current search parameters.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorErrors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.6}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorWarnings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.5}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorInfo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
              <XAxis dataKey="time" stroke="#64748b" fontSize={9} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={9} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#020617',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: '#f8fafc'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />
              <Area
                type="monotone"
                dataKey="errors"
                name="Fatal / Error"
                stroke="#ef4444"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorErrors)"
              />
              <Area
                type="monotone"
                dataKey="warnings"
                name="Warn Level"
                stroke="#f59e0b"
                strokeWidth={1.5}
                fillOpacity={1}
                fill="url(#colorWarnings)"
              />
              <Area
                type="monotone"
                dataKey="info"
                name="Info / Debug"
                stroke="#6366f1"
                strokeWidth={1}
                fillOpacity={1}
                fill="url(#colorInfo)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

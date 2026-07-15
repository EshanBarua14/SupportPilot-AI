import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as Icons from 'lucide-react';

interface Alert {
  id: string;
  message: string;
  zone: string;
  category: string;
}

interface AlertsTickerProps {
  tickerAlerts: Alert[];
  selectedTickerIds: string[];
  setSelectedTickerIds: React.Dispatch<React.SetStateAction<string[]>>;
  showBulkAlertPopover: boolean;
  setShowBulkAlertPopover: (show: boolean) => void;
  handleBulkAlertAction: (action: 'Acknowledge' | 'Dismiss') => void;
}

const AlertsTickerComponent: React.FC<AlertsTickerProps> = ({
  tickerAlerts,
  selectedTickerIds,
  setSelectedTickerIds,
  showBulkAlertPopover,
  setShowBulkAlertPopover,
  handleBulkAlertAction,
}) => {
  return (
    <div className="relative flex h-8 shrink-0 items-center justify-between border-b border-rose-500/10 bg-rose-500/5 px-6 font-mono text-xxs text-rose-300">
      <div className="flex items-center space-x-2 overflow-hidden mr-4">
        <Icons.Bell className={`h-3.5 w-3.5 shrink-0 ${tickerAlerts.length > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`} />
        <span className={`font-bold shrink-0 ${tickerAlerts.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
          {tickerAlerts.length > 0 ? 'SYSTEM ALERTS:' : 'MONITORING ENGINE STATUS:'}
        </span>
        <span className="truncate">
          {tickerAlerts.length > 0 
            ? tickerAlerts[0].message 
            : '✅ All high-priority operational system outages have been successfully resolved. System compliance stable.'}
        </span>
      </div>
      <div className="flex items-center space-x-4 shrink-0 font-mono">
        {tickerAlerts.length > 0 ? (
          <>
            <span className="hidden md:inline text-slate-500">Zone: {tickerAlerts[0].zone}</span>
            <span className="text-rose-400 font-semibold uppercase hidden md:inline">ACTIVE ALERTS: {tickerAlerts.length}</span>
            <button
              onClick={() => setShowBulkAlertPopover(!showBulkAlertPopover)}
              className="flex items-center space-x-1 border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded cursor-pointer transition-colors font-bold uppercase text-[9px]"
            >
              <Icons.Sliders className="h-2.5 w-2.5" />
              <span>Bulk Actions ({tickerAlerts.length})</span>
            </button>
          </>
        ) : (
          <span className="text-emerald-400 font-bold uppercase text-[9px] border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded">
            SECURE STATE STABLE
          </span>
        )}
      </div>

      {/* Bulk Action Popover Overlay */}
      <AnimatePresence>
        {showBulkAlertPopover && tickerAlerts.length > 0 && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowBulkAlertPopover(false)} />
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="absolute right-6 top-8 z-50 w-80 rounded-xl border border-slate-900 bg-slate-950 p-3.5 shadow-2xl backdrop-blur-xl font-mono text-[10px]"
            >
              <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-2">
                <span className="text-rose-400 font-bold tracking-wider text-[8.5px] uppercase">Acknowledge & Dismiss Portal</span>
                <button
                  onClick={() => {
                    if (selectedTickerIds.length === tickerAlerts.length) {
                      setSelectedTickerIds([]);
                    } else {
                      setSelectedTickerIds(tickerAlerts.map(a => a.id));
                    }
                  }}
                  className="text-[8px] text-indigo-400 hover:text-indigo-300 underline font-bold cursor-pointer"
                >
                  {selectedTickerIds.length === tickerAlerts.length ? 'Clear All' : 'Select All'}
                </button>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 mb-3">
                {tickerAlerts.map(alt => {
                  const isChecked = selectedTickerIds.includes(alt.id);
                  return (
                    <div
                      key={alt.id}
                      onClick={() => {
                        setSelectedTickerIds(prev =>
                          isChecked ? prev.filter(id => id !== alt.id) : [...prev, alt.id]
                        );
                      }}
                      className={`flex items-start space-x-2 p-2 rounded-lg border cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                          : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:border-slate-800 hover:bg-slate-900/80'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by div click
                        className="mt-0.5 rounded border-slate-800 bg-slate-950 text-rose-500 focus:ring-0 focus:ring-offset-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between font-bold mb-0.5">
                          <span className="text-white text-[9px]">{alt.category}</span>
                          <span className="text-[7.5px] text-slate-500 uppercase">{alt.zone}</span>
                        </div>
                        <p className="text-[9px] leading-relaxed line-clamp-2 text-slate-300">{alt.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center space-x-2 border-t border-slate-900 pt-2 text-[9px]">
                <button
                  onClick={() => handleBulkAlertAction('Acknowledge')}
                  disabled={selectedTickerIds.length === 0}
                  className="flex-1 flex items-center justify-center space-x-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold py-1.5 rounded-lg cursor-pointer transition-all uppercase"
                >
                  <Icons.Check className="h-3 w-3" />
                  <span>Ack ({selectedTickerIds.length})</span>
                </button>
                <button
                  onClick={() => handleBulkAlertAction('Dismiss')}
                  disabled={selectedTickerIds.length === 0}
                  className="flex-1 flex items-center justify-center space-x-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 text-slate-300 font-bold py-1.5 rounded-lg cursor-pointer transition-all uppercase"
                >
                  <Icons.Trash className="h-3 w-3" />
                  <span>Dismiss ({selectedTickerIds.length})</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export const AlertsTicker = React.memo(AlertsTickerComponent);

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

// Word-based Jaccard Similarity Scorer to detect redundant alerts
function calculateStringSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(str2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

interface GroupedAlert {
  parent: Alert;
  children: Array<{
    alert: Alert;
    score: number;
  }>;
}

function groupAlerts(alerts: Alert[]): GroupedAlert[] {
  const groups: GroupedAlert[] = [];
  
  alerts.forEach(alert => {
    let foundGroup = false;
    for (const group of groups) {
      const similarity = calculateStringSimilarity(group.parent.message, alert.message);
      // Group if Jaccard similarity > 0.40 OR the categories and zones match exactly
      if (similarity > 0.40 || (group.parent.category === alert.category && group.parent.zone === alert.zone)) {
        group.children.push({ alert, score: similarity });
        foundGroup = true;
        break;
      }
    }
    if (!foundGroup) {
      groups.push({ parent: alert, children: [] });
    }
  });
  
  return groups;
}

const AlertsTickerComponent: React.FC<AlertsTickerProps> = ({
  tickerAlerts,
  selectedTickerIds,
  setSelectedTickerIds,
  showBulkAlertPopover,
  setShowBulkAlertPopover,
  handleBulkAlertAction,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Group the current alerts
  const alertGroups = React.useMemo(() => groupAlerts(tickerAlerts), [tickerAlerts]);
  const totalCollapsed = tickerAlerts.length - alertGroups.length;

  return (
    <div className="flex flex-col border-b border-rose-500/10 bg-rose-500/5 transition-all duration-300">
      {/* Primary Ticker Bar */}
      <div className="flex h-8 shrink-0 items-center justify-between px-6 font-mono text-xxs text-rose-300">
        <div className="flex items-center space-x-2 overflow-hidden mr-4">
          <Icons.Bell className={`h-3.5 w-3.5 shrink-0 ${tickerAlerts.length > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`} />
          <span className={`font-bold shrink-0 ${tickerAlerts.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {tickerAlerts.length > 0 ? 'SYSTEM ALERTS:' : 'MONITORING ENGINE STATUS:'}
          </span>
          
          <span className="truncate">
            {tickerAlerts.length > 0 ? (
              <span>
                {alertGroups[0].parent.message}
                {alertGroups[0].children.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-rose-500/20 text-[8px] font-bold text-rose-400 border border-rose-500/30">
                    +{alertGroups[0].children.length} REDUNDANT COLLAPSED
                  </span>
                )}
              </span>
            ) : (
              '✅ All high-priority operational system outages have been successfully resolved. System compliance stable.'
            )}
          </span>
        </div>

        <div className="flex items-center space-x-3 shrink-0 font-mono">
          {tickerAlerts.length > 0 ? (
            <>
              {totalCollapsed > 0 && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center space-x-1 border border-rose-500/40 bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 px-2 py-0.5 rounded cursor-pointer transition-colors font-bold uppercase text-[9px] hover:border-rose-400"
                  title="Toggle smart grouping of similar alerts"
                >
                  {isExpanded ? <Icons.ChevronUp className="h-2.5 w-2.5" /> : <Icons.ChevronDown className="h-2.5 w-2.5" />}
                  <span>{isExpanded ? 'Collapse Groups' : `Expand Groups (${alertGroups.length})`}</span>
                </button>
              )}
              
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
      </div>

      {/* Expanded Smart Groups View */}
      {isExpanded && tickerAlerts.length > 0 && (
        <div className="px-6 pb-3 pt-1 border-t border-rose-500/10 bg-rose-950/20 max-h-60 overflow-y-auto">
          <div className="flex items-center justify-between mb-2 pb-1 border-b border-rose-500/10">
            <span className="font-mono text-[8.5px] text-rose-400/80 font-bold uppercase tracking-wider flex items-center space-x-1.5">
              <Icons.Layers className="h-3 w-3 animate-pulse" />
              <span>Intelligent Deduplication Engine • Similarity Threshold: &gt;40% Jaccard Overlap</span>
            </span>
            <span className="font-mono text-[8px] text-slate-500">
              Deduplicated {totalCollapsed} redundant system warnings into {alertGroups.length} clean parent categories.
            </span>
          </div>

          <div className="space-y-3 font-mono">
            {alertGroups.map((group) => {
              const isParentChecked = selectedTickerIds.includes(group.parent.id);
              return (
                <div key={group.parent.id} className="rounded border border-slate-900/40 bg-slate-950/30 p-2 text-xxs">
                  {/* Parent Alert Row */}
                  <div className="flex items-start justify-between space-x-2">
                    <div className="flex items-start space-x-2 flex-1">
                      <input
                        type="checkbox"
                        checked={isParentChecked}
                        onChange={() => {
                          setSelectedTickerIds(prev => {
                            const isCurrentlyChecked = prev.includes(group.parent.id);
                            // We toggle parent AND all its child nodes simultaneously!
                            const allIds = [group.parent.id, ...group.children.map(c => c.alert.id)];
                            if (isCurrentlyChecked) {
                              return prev.filter(id => !allIds.includes(id));
                            } else {
                              const newIds = allIds.filter(id => !prev.includes(id));
                              return [...prev, ...newIds];
                            }
                          });
                        }}
                        className="mt-0.5 rounded border-rose-500/30 bg-slate-950 text-rose-500 focus:ring-0 cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center space-x-2 text-[8px] font-bold text-rose-400 mb-0.5 uppercase">
                          <span className="bg-rose-500/15 border border-rose-500/25 px-1 py-0.2 rounded text-white font-extrabold">{group.parent.category}</span>
                          <span className="text-slate-500">{group.parent.zone}</span>
                          <span className="text-slate-600 font-normal">ID: {group.parent.id}</span>
                        </div>
                        <p className="text-rose-200/90 leading-snug">{group.parent.message}</p>
                      </div>
                    </div>
                  </div>

                  {/* Children Row Indents */}
                  {group.children.map((child) => {
                    const isChildChecked = selectedTickerIds.includes(child.alert.id);
                    return (
                      <div key={child.alert.id} className="ml-6 mt-1.5 pl-3 border-l border-rose-500/10 flex items-start space-x-2">
                        <span className="text-rose-500/50 mt-0.5 select-none font-bold">└─</span>
                        <input
                          type="checkbox"
                          checked={isChildChecked}
                          onChange={() => {
                            setSelectedTickerIds(prev => 
                              isChildChecked ? prev.filter(id => id !== child.alert.id) : [...prev, child.alert.id]
                            );
                          }}
                          className="mt-0.5 rounded border-rose-500/20 bg-slate-950 text-rose-500 focus:ring-0 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-1.5 text-[7.5px] font-bold text-slate-500 uppercase">
                            <span className="text-slate-400 bg-slate-900 border border-slate-800 px-0.5 rounded text-[7px]">{child.alert.category}</span>
                            <span>•</span>
                            <span className="text-indigo-400 bg-indigo-500/10 px-1 py-0.1 rounded font-extrabold">Similarity: {Math.round(child.score * 100)}%</span>
                          </div>
                          <p className="text-slate-400 text-[9.5px] leading-snug">{child.alert.message}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                        className="mt-0.5 rounded border-slate-800 bg-slate-950 text-rose-500 focus:ring-0"
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

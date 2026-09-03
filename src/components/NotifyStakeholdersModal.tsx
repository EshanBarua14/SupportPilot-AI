import React, { useState } from 'react';
import { Incident } from '../types';
import * as Icons from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NotifyStakeholdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIncidents: Incident[];
  onAddAuditLog?: (user: string, action: string, area: string, status: 'SUCCESS' | 'FAILED' | 'PENDING_APPROVAL', details: string) => void;
  onRecordBulkHistory?: (type: string, description: string, count: number) => void;
}

const DEFAULT_SLACK_CHANNELS = [
  { id: 'incidents-critical', name: '#incidents-critical', desc: 'P0/P1 High Urgency Executive Channel', defaultChecked: true },
  { id: 'noc-war-room', name: '#noc-war-room', desc: 'On-Call Engineers & Site Reliability Team', defaultChecked: true },
  { id: 'devops-alerts', name: '#devops-alerts', desc: 'Infrastructure & CI/CD Pipeline Monitoring', defaultChecked: false },
  { id: 'executive-status', name: '#executive-status', desc: 'C-Suite Briefings & SLA Compliance', defaultChecked: false },
];

export function NotifyStakeholdersModal({
  isOpen,
  onClose,
  selectedIncidents,
  onAddAuditLog,
  onRecordBulkHistory
}: NotifyStakeholdersModalProps) {
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['incidents-critical', 'noc-war-room']);
  const [customChannel, setCustomChannel] = useState<string>('');
  const [customNote, setCustomNote] = useState<string>('');
  const [urgencyLevel, setUrgencyLevel] = useState<'CRITICAL' | 'STANDARD' | 'INFORMATIONAL'>('CRITICAL');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendSuccess, setSendSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const totalCount = selectedIncidents.length;
  const criticalCount = selectedIncidents.filter(i => i.severity === 'CRITICAL').length;
  const highCount = selectedIncidents.filter(i => i.severity === 'HIGH').length;

  const toggleChannel = (id: string) => {
    setSelectedChannels(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  // Generate markdown slack report preview
  const generateSlackMarkdown = () => {
    const channelNames = selectedChannels
      .map(id => DEFAULT_SLACK_CHANNELS.find(c => c.id === id)?.name)
      .concat(customChannel ? [`#${customChannel.replace(/^#/, '')}`] : [])
      .filter(Boolean)
      .join(', ');

    return `🚨 *INCIDENT CONSOLIDATED REPORT (${totalCount} TICKETS)*
*Urgency Level:* :fire: ${urgencyLevel} | *Dispatched To:* \`${channelNames || '#incidents-critical'}\`
*Dispatched By:* Alex Vance (Admin) | *Timestamp:* ${new Date().toLocaleTimeString()}

${customNote ? `> 📝 *Executive Note:* ${customNote}\n\n` : ''}*Summary Breakdown:*
- *Critical (P0):* ${criticalCount}
- *High (P1):* ${highCount}
- *Other:* ${totalCount - criticalCount - highCount}

*Incident Manifest:*
${selectedIncidents.slice(0, 5).map(inc => `• *[${inc.id}]* \`${inc.severity}\` - *${inc.title}* (_${inc.appName || 'Core'}_) -> Status: \`${inc.status}\``).join('\n')}
${selectedIncidents.length > 5 ? `_...and ${selectedIncidents.length - 5} more selected incidents._` : ''}

*Recommended Next Action:* Review war room dashboard & trigger automated remediation scripts.`;
  };

  const handleSendNotification = async () => {
    setIsSending(true);
    try {
      const channelNames = selectedChannels
        .map(id => DEFAULT_SLACK_CHANNELS.find(c => c.id === id)?.name)
        .concat(customChannel ? [`#${customChannel.replace(/^#/, '')}`] : [])
        .filter(Boolean);

      const response = await fetch('/api/notify-slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channels: channelNames,
          urgencyLevel,
          customNote,
          incidentIds: selectedIncidents.map(i => i.id),
          payloadPreview: generateSlackMarkdown()
        })
      });

      if (onAddAuditLog) {
        onAddAuditLog(
          'Alex Vance (Admin)',
          'Slack Stakeholder Notification Dispatched',
          'Integrated Notification Gateway',
          'SUCCESS',
          `Sent consolidated report for ${totalCount} incidents to channels: [${channelNames.join(', ')}] with urgency ${urgencyLevel}`
        );
      }

      if (onRecordBulkHistory) {
        onRecordBulkHistory('SLACK_NOTIFY', `Notified channels (${channelNames.join(', ')}) with ${totalCount} incidents`, totalCount);
      }

      setSendSuccess(true);
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: `Slack notification successfully dispatched to ${channelNames.length} channel(s).` }
      }));

      setTimeout(() => {
        setSendSuccess(false);
        setIsSending(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error(err);
      setIsSending(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-2xl rounded-2xl border border-indigo-500/40 bg-slate-950 p-6 shadow-2xl space-y-5 font-mono relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-3 text-indigo-400">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Icons.Send className="h-5 w-5 text-indigo-400 animate-pulse" />
              </div>
              <div>
                <h4 className="font-display font-bold text-sm text-white flex items-center space-x-2">
                  <span>Notify Stakeholders & Slack Channels</span>
                  <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono border border-indigo-500/30">
                    {totalCount} Incident(s)
                  </span>
                </h4>
                <p className="text-[10px] text-slate-400">
                  Broadcast consolidated incident status summary via integrated notification gateway
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

          <div className="grid grid-cols-2 gap-4">
            {/* Left Column: Settings */}
            <div className="space-y-3">
              {/* Channel Selection */}
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-bold mb-1.5">
                  1. Target Slack Channels:
                </span>
                <div className="space-y-1.5">
                  {DEFAULT_SLACK_CHANNELS.map(ch => (
                    <label
                      key={ch.id}
                      className={`flex items-start space-x-2 p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                        selectedChannels.includes(ch.id)
                          ? 'bg-indigo-950/60 border-indigo-500/50 text-indigo-200'
                          : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedChannels.includes(ch.id)}
                        onChange={() => toggleChannel(ch.id)}
                        className="mt-0.5 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="font-bold font-mono text-[11px]">{ch.name}</div>
                        <div className="text-[9px] text-slate-400">{ch.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Custom Channel Input */}
              <div className="space-y-1">
                <span className="text-[9.5px] text-slate-400 font-bold">Or Add Custom Channel Name:</span>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-slate-500 font-mono text-xs">#</span>
                  <input
                    type="text"
                    value={customChannel}
                    onChange={(e) => setCustomChannel(e.target.value)}
                    placeholder="e.g. platform-oncall-warroom"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-6 pr-3 py-1.5 text-xs text-slate-200 font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Urgency Selector */}
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-bold">
                  2. Broadcast Urgency Level:
                </span>
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 text-[10px]">
                  {(['CRITICAL', 'STANDARD', 'INFORMATIONAL'] as const).map(u => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUrgencyLevel(u)}
                      className={`py-1 rounded-lg font-bold font-mono transition-all cursor-pointer ${
                        urgencyLevel === u
                          ? u === 'CRITICAL' ? 'bg-rose-950 text-rose-300 border border-rose-500/50' : 'bg-indigo-950 text-indigo-300 border border-indigo-500/50'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Message Preview & Custom Note */}
            <div className="space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-bold">
                  3. Executive Note (Optional):
                </span>
                <textarea
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="e.g. All engineers please join #noc-war-room voice channel immediately. DB failover underway."
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono rounded-xl p-2.5 focus:border-indigo-500 focus:outline-none resize-none"
                />

                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-bold pt-1">
                  Slack Payload Live Preview:
                </span>
                <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 font-mono text-[9.5px] text-slate-300 max-h-44 overflow-y-auto whitespace-pre-wrap leading-relaxed border-l-4 border-l-indigo-500">
                  {generateSlackMarkdown()}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendNotification}
                  disabled={isSending || sendSuccess}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-indigo-600/30 flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {sendSuccess ? (
                    <>
                      <Icons.CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>Sent Successfully!</span>
                    </>
                  ) : isSending ? (
                    <>
                      <Icons.RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Dispatching Notification...</span>
                    </>
                  ) : (
                    <>
                      <Icons.Send className="h-4 w-4" />
                      <span>Dispatch to Slack</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default NotifyStakeholdersModal;

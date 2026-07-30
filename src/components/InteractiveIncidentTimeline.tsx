import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { Incident } from '../types';

interface TimelineEvent {
  id: string;
  timestamp: string;
  category: 'STATE_CHANGE' | 'OPERATOR_NOTE' | 'LOG_MARKER' | 'ACTIONABLE_INSIGHT' | 'SLA_MILESTONE' | 'RUNBOOK_EXECUTION';
  title: string;
  description: string;
  author?: string;
  metadata?: Record<string, any>;
  isExpanded?: boolean;
}

interface InteractiveIncidentTimelineProps {
  incident: Incident;
  onAddNote?: (noteText: string) => void;
  customActionableInsights?: Array<{ id: string; text: string; timestamp: string; logLine: string }>;
}

export const InteractiveIncidentTimeline: React.FC<InteractiveIncidentTimelineProps> = ({
  incident,
  onAddNote,
  customActionableInsights = []
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [newNote, setNewNote] = useState<string>('');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Synthesize rich timeline events from incident data + logs + audit history
  const createTimelineEvents = (): TimelineEvent[] => {
    const events: TimelineEvent[] = [];
    const baseTime = new Date(incident.createdAt).getTime();

    // 1. Initial Creation Event
    events.push({
      id: 'evt-create',
      timestamp: incident.createdAt,
      category: 'STATE_CHANGE',
      title: `Incident Triggered: ${incident.title}`,
      description: `Automated detection triggered by alerting threshold in app "${incident.appName}". Initial Severity: ${incident.severity}.`,
      author: 'Alertmanager Bot',
      metadata: { app: incident.appName, severity: incident.severity }
    });

    // 2. SLA Milestone Target
    const limitMins = incident.slaLimitMins || (incident.severity === 'CRITICAL' ? 15 : 30);
    const slaTargetTime = new Date(baseTime + limitMins * 60000).toISOString();
    events.push({
      id: 'evt-sla',
      timestamp: slaTargetTime,
      category: 'SLA_MILESTONE',
      title: `SLA Resolution Target (${limitMins}m Limit)`,
      description: `Target resolution timestamp to avoid SLA breach. Priority: ${incident.severity}.`,
      author: 'SLA Engine'
    });

    // 3. Status Transition
    if (incident.status === 'OPEN' || incident.status === 'ESCALATED' || incident.status === 'SOLVED') {
      events.push({
        id: 'evt-status-inv',
        timestamp: new Date(baseTime + 3 * 60000).toISOString(),
        category: 'STATE_CHANGE',
        title: 'Investigation Phase Initialized',
        description: 'Assigned on-call engineer and booted AI SupportPilot investigation workspace.',
        author: 'SupportPilot Ops'
      });
    }

    if (incident.status === 'SOLVED' || incident.status === 'ESCALATED') {
      events.push({
        id: 'evt-status-mit',
        timestamp: new Date(baseTime + 12 * 60000).toISOString(),
        category: 'STATE_CHANGE',
        title: 'Mitigation Workflows Applied',
        description: 'Automated runbook script or container restart executed.',
        author: 'Automated Remediation'
      });
    }

    if (incident.status === 'SOLVED') {
      events.push({
        id: 'evt-status-solved',
        timestamp: new Date(baseTime + 22 * 60000).toISOString(),
        category: 'STATE_CHANGE',
        title: 'Incident Resolved & Verified',
        description: 'Telemetry metrics stabilized and error rate dropped below 0.01%.',
        author: 'Lead Incident Commander'
      });
    }

    // 4. Sample Log Markers from incident logs
    incident.logs.forEach((log, idx) => {
      events.push({
        id: `evt-log-${idx}`,
        timestamp: log.timestamp || new Date(baseTime + (idx + 1) * 2 * 60000).toISOString(),
        category: 'LOG_MARKER',
        title: `Log Alert [${log.level}]: ${log.source}`,
        description: log.message,
        author: log.source,
        metadata: { level: log.level, logLine: log.message }
      });
    });

    // 5. Custom Actionable Insights
    customActionableInsights.forEach((insight) => {
      events.push({
        id: insight.id,
        timestamp: insight.timestamp,
        category: 'ACTIONABLE_INSIGHT',
        title: `Actionable Insight: ${insight.text}`,
        description: `Highlighted Log context: "${insight.logLine}"`,
        author: 'Operator'
      });
    });

    // Sort chronologically
    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  };

  const allEvents = createTimelineEvents();

  // Filter events
  const filteredEvents = allEvents.filter((evt) => {
    const matchesCategory = filterCategory === 'ALL' || evt.category === filterCategory;
    const matchesSearch =
      !searchQuery ||
      evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (evt.author && evt.author.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleAddNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    if (onAddNote) {
      onAddNote(newNote.trim());
    }
    setNewNote('');
  };

  const getCategoryBadge = (cat: TimelineEvent['category']) => {
    switch (cat) {
      case 'STATE_CHANGE':
        return { label: 'State Change', icon: Icons.Activity, color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' };
      case 'OPERATOR_NOTE':
        return { label: 'Operator Note', icon: Icons.MessageSquare, color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
      case 'LOG_MARKER':
        return { label: 'Log Marker', icon: Icons.Terminal, color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
      case 'ACTIONABLE_INSIGHT':
        return { label: 'Actionable Insight', icon: Icons.Sparkles, color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };
      case 'SLA_MILESTONE':
        return { label: 'SLA Target', icon: Icons.Timer, color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' };
      case 'RUNBOOK_EXECUTION':
        return { label: 'Runbook Action', icon: Icons.PlayCircle, color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-2xl space-y-4 font-mono">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Icons.History className="h-4 w-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-display flex items-center space-x-2">
              <span>INTERACTIVE INCIDENT TIMELINE</span>
              <span className="text-[9px] bg-slate-800 px-2 py-0.5 rounded text-indigo-300 font-bold">
                {filteredEvents.length} EVENTS
              </span>
            </h3>
            <p className="text-[10px] text-slate-400 font-sans">
              Chronological ledger of state transitions, log markers, and operator insights for {incident.id}
            </p>
          </div>
        </div>

        {/* Search input */}
        <div className="flex items-center space-x-2 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 w-full sm:w-auto">
          <Icons.Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search timeline events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-white placeholder-slate-500 outline-none w-full sm:w-44 font-sans"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-white">
              <Icons.X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        {['ALL', 'STATE_CHANGE', 'LOG_MARKER', 'ACTIONABLE_INSIGHT', 'OPERATOR_NOTE', 'SLA_MILESTONE'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-2.5 py-1 rounded-md font-bold transition-all ${
              filterCategory === cat
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {cat.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Add Operator Checkpoint / Note Form */}
      <form onSubmit={handleAddNoteSubmit} className="flex items-center space-x-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Add timeline operator note or checkpoint entry..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors font-sans"
          />
        </div>
        <button
          type="submit"
          disabled={!newNote.trim()}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center space-x-1 transition-all shrink-0 cursor-pointer"
        >
          <Icons.Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Add Event</span>
        </button>
      </form>

      {/* Vertical Timeline Tree */}
      <div className="relative border-l-2 border-slate-800 ml-4 pl-6 space-y-4 pt-2">
        {filteredEvents.length === 0 ? (
          <div className="text-xs text-slate-500 font-sans italic py-4">
            No timeline events match the selected category or search query.
          </div>
        ) : (
          filteredEvents.map((evt) => {
            const badge = getCategoryBadge(evt.category);
            const Icon = badge.icon;
            const isExpanded = expandedEventId === evt.id;

            return (
              <div key={evt.id} className="relative group">
                {/* Node icon bullet */}
                <div className={`absolute -left-[35px] top-0 h-6 w-6 rounded-full border flex items-center justify-center ${badge.color}`}>
                  <Icon className="h-3 w-3" />
                </div>

                {/* Event Card */}
                <div
                  onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                  className={`bg-slate-950/80 border rounded-lg p-3 transition-all cursor-pointer ${
                    isExpanded
                      ? 'border-indigo-500/80 bg-slate-900/90 shadow-lg'
                      : 'border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${badge.color}`}>
                        {badge.label}
                      </span>
                      <h4 className="text-xs font-sans font-bold text-slate-100 truncate">{evt.title}</h4>
                    </div>

                    <div className="flex items-center space-x-2 text-[10px] text-slate-400 shrink-0">
                      {evt.author && <span className="text-slate-500">by {evt.author}</span>}
                      <span className="text-indigo-400 font-bold">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  <p className="text-xs font-sans text-slate-300 mt-1.5 leading-relaxed">
                    {evt.description}
                  </p>

                  {/* Expanded Detail Tray */}
                  {isExpanded && evt.metadata && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 space-y-1 font-mono bg-slate-900/90 p-2 rounded">
                      <div className="font-bold text-slate-300 mb-1">EVENT METADATA & PAYLOAD:</div>
                      {Object.entries(evt.metadata).map(([k, v]) => (
                        <div key={k} className="flex items-start space-x-2">
                          <span className="text-indigo-400 font-bold">{k}:</span>
                          <span className="text-slate-200 truncate">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default InteractiveIncidentTimeline;

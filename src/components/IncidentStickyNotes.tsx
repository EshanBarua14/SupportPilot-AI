import React, { useState } from 'react';
import * as Icons from 'lucide-react';

export interface StickyNote {
  id: string;
  author: string;
  role: string;
  avatarColor: string;
  noteColor: 'yellow' | 'emerald' | 'cyan' | 'purple' | 'rose';
  content: string;
  timestamp: string;
  isPinned: boolean;
  upvotes: number;
}

interface IncidentStickyNotesProps {
  incidentId: string;
  currentOperator?: string;
}

const INITIAL_NOTES_BY_INCIDENT: Record<string, StickyNote[]> = {
  default: [
    {
      id: 'sn-1',
      author: 'Sarah Chen',
      role: 'DBA Lead',
      avatarColor: 'bg-indigo-500',
      noteColor: 'yellow',
      content: 'Checked PostgreSQL pg_stat_activity. 14 idle-in-transaction connections holding row locks on billing_invoices.',
      timestamp: '10:42 AM',
      isPinned: true,
      upvotes: 4
    },
    {
      id: 'sn-2',
      author: 'Alex Rivera',
      role: 'Infra SRE',
      avatarColor: 'bg-emerald-500',
      noteColor: 'cyan',
      content: 'Worker pod replica 4 was auto-scaled from 2 -> 6. Memory saturation dropped from 94% down to 58%.',
      timestamp: '10:48 AM',
      isPinned: false,
      upvotes: 2
    },
    {
      id: 'sn-3',
      author: 'Alex Vance',
      role: 'L3 Ops Lead',
      avatarColor: 'bg-amber-500',
      noteColor: 'emerald',
      content: 'Communicated incident update to Customer Success team. SLA timer reset to +25 minutes.',
      timestamp: '10:52 AM',
      isPinned: false,
      upvotes: 3
    }
  ]
};

export const IncidentStickyNotes: React.FC<IncidentStickyNotesProps> = ({
  incidentId,
  currentOperator = 'Alex Vance'
}) => {
  const [notes, setNotes] = useState<StickyNote[]>(() => {
    return INITIAL_NOTES_BY_INCIDENT[incidentId] || INITIAL_NOTES_BY_INCIDENT['default'];
  });

  const [newContent, setNewContent] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<StickyNote['noteColor']>('yellow');
  const [authorName, setAuthorName] = useState<string>(currentOperator);
  const [roleTitle, setRoleTitle] = useState<string>('Support Engineer');

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    const newNote: StickyNote = {
      id: `sn-${Date.now()}`,
      author: authorName.trim() || 'Support Member',
      role: roleTitle.trim() || 'L2 Ops',
      avatarColor: selectedColor === 'yellow' ? 'bg-amber-500' : selectedColor === 'emerald' ? 'bg-emerald-500' : selectedColor === 'cyan' ? 'bg-cyan-500' : selectedColor === 'purple' ? 'bg-purple-500' : 'bg-rose-500',
      noteColor: selectedColor,
      content: newContent.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isPinned: false,
      upvotes: 1
    };

    setNotes(prev => [newNote, ...prev]);
    setNewContent('');
  };

  const togglePin = (id: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, isPinned: !n.isPinned } : n));
  };

  const handleUpvote = (id: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, upvotes: n.upvotes + 1 } : n));
  };

  const handleDelete = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  // Color mappings for sticky note cards
  const colorStyles = {
    yellow: 'bg-amber-950/40 border-amber-500/40 text-amber-100 shadow-amber-500/10',
    emerald: 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100 shadow-emerald-500/10',
    cyan: 'bg-cyan-950/40 border-cyan-500/40 text-cyan-100 shadow-cyan-500/10',
    purple: 'bg-purple-950/40 border-purple-500/40 text-purple-100 shadow-purple-500/10',
    rose: 'bg-rose-950/40 border-rose-500/40 text-rose-100 shadow-rose-500/10'
  };

  const sortedNotes = [...notes].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));

  return (
    <div className="bg-slate-950/90 border border-slate-800/80 rounded-xl p-4 shadow-xl font-mono space-y-4 my-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Icons.StickyNote className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display font-bold text-xs text-white uppercase tracking-wider flex items-center space-x-2">
              <span>Support Team Multi-User Sticky Notes</span>
              <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[8.5px]">
                {notes.length} Active Remarks
              </span>
            </h3>
            <p className="text-[9.5px] text-slate-400">Attach collaborative investigation notes, observations, and handoff comments</p>
          </div>
        </div>
      </div>

      {/* New Sticky Note Input Form */}
      <form onSubmit={handleAddNote} className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-3 font-sans">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xxs font-mono">
          <div>
            <label className="text-slate-400 text-[9px] uppercase tracking-wider block mb-1">Author Name</label>
            <input
              type="text"
              value={authorName}
              onChange={e => setAuthorName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-indigo-500 text-xxs font-mono"
            />
          </div>
          <div>
            <label className="text-slate-400 text-[9px] uppercase tracking-wider block mb-1">Team Role / Title</label>
            <input
              type="text"
              value={roleTitle}
              onChange={e => setRoleTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-indigo-500 text-xxs font-mono"
            />
          </div>
        </div>

        <div>
          <textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            placeholder="Type investigation note or team remark..."
            rows={2}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-sans leading-relaxed resize-none"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Note Color Selector */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[9px] font-mono text-slate-400 uppercase mr-1">Note Color:</span>
            {(['yellow', 'cyan', 'emerald', 'purple', 'rose'] as const).map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedColor(c)}
                className={`h-5 w-5 rounded-full border cursor-pointer transition-transform ${
                  selectedColor === c ? 'scale-125 ring-2 ring-white' : 'opacity-70 hover:opacity-100'
                } ${
                  c === 'yellow' ? 'bg-amber-400 border-amber-300'
                    : c === 'cyan' ? 'bg-cyan-400 border-cyan-300'
                    : c === 'emerald' ? 'bg-emerald-400 border-emerald-300'
                    : c === 'purple' ? 'bg-purple-400 border-purple-300'
                    : 'bg-rose-400 border-rose-300'
                }`}
              />
            ))}
          </div>

          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-xxs uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 shadow"
          >
            <Icons.Plus className="h-3.5 w-3.5" />
            <span>Post Sticky Note</span>
          </button>
        </div>
      </form>

      {/* Grid of Sticky Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {sortedNotes.map(n => (
          <div
            key={n.id}
            className={`border rounded-xl p-3 space-y-2 relative shadow-lg transition-all hover:-translate-y-0.5 ${colorStyles[n.noteColor]}`}
          >
            {/* Top Bar inside card */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center space-x-2">
                <div className={`h-5 w-5 rounded-full ${n.avatarColor} text-white font-bold text-[9px] flex items-center justify-center shrink-0`}>
                  {n.author.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-xs text-white leading-tight font-sans">{n.author}</div>
                  <div className="text-[8.5px] font-mono text-slate-400">{n.role} • {n.timestamp}</div>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => togglePin(n.id)}
                  className={`p-1 rounded hover:bg-white/10 transition-colors ${n.isPinned ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
                  title={n.isPinned ? 'Unpin Note' : 'Pin Note to Top'}
                >
                  <Icons.Pin className={`h-3 w-3 ${n.isPinned ? 'fill-amber-400' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(n.id)}
                  className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-colors"
                  title="Delete Note"
                >
                  <Icons.Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Content */}
            <p className="text-xs font-sans text-slate-100 leading-relaxed select-text py-1">
              {n.content}
            </p>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[9px] font-mono">
              <button
                type="button"
                onClick={() => handleUpvote(n.id)}
                className="flex items-center space-x-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors cursor-pointer text-slate-200"
              >
                <Icons.ThumbsUp className="h-2.5 w-2.5 text-amber-400" />
                <span>Upvote ({n.upvotes})</span>
              </button>

              {n.isPinned && (
                <span className="text-amber-400 font-bold uppercase tracking-wider text-[8px] flex items-center space-x-1">
                  <Icons.Pin className="h-2.5 w-2.5" />
                  <span>PINNED</span>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

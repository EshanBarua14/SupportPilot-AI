import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import CommandPalette from './components/CommandPalette';
import AgentOrchestrator from './components/AgentOrchestrator';
import IncidentWorkspace from './components/IncidentWorkspace';
import MetricsDashboard from './components/MetricsDashboard';
import RunbookManager from './components/RunbookManager';
import SettingsConsole from './components/SettingsConsole';
import AuditPanel from './components/AuditPanel';
import AspNetConsole from './components/AspNetConsole';
import ShortcutsModal from './components/ShortcutsModal';
import SystemHealthPanel from './components/SystemHealthPanel';
import SignalRClientManager from './components/SignalRClientManager';
import NotificationBell from './components/NotificationBell';
import { ActiveUser } from './data/simulation';
import * as Icons from 'lucide-react';
import { SupportPilotProvider, useSupportPilot } from './context/SupportPilotContext';
import { useSearchMetrics } from './hooks/useSearchMetrics';
import ErrorBoundary from './components/ErrorBoundary';
import { SidebarNavigation } from './components/SidebarNavigation';
import { AlertsTicker } from './components/AlertsTicker';

const HighlightMatch = ({ text, query }: { text: string; query: string }) => {
  if (!query || !query.trim() || !text) return <>{text}</>;
  const trimmed = query.trim();
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark
            key={i}
            className="bg-amber-400/30 text-amber-200 font-extrabold px-0.5 rounded underline decoration-amber-400/80"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

function AppContent() {
  const {
    activeTab,
    setActiveTab,
    modelSelection,
    setModelSelection,
    isPinned,
    setIsPinned,
    sidebarMode,
    setSidebarMode,
    isHovered,
    setIsHovered,
    auditLogs,
    handleAddAuditLog,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    isShortcutsOpen,
    setIsShortcutsOpen,
    toastMessage,
    setToastMessage,
    searchQuery,
    setSearchQuery,
    showSearchPreview,
    setShowSearchPreview,
    selectedSearchRunbook,
    setSelectedSearchRunbook,
    isLocked,
    setIsLocked,
    secondsRemaining,
    setSecondsRemaining,
    themeSuggestion,
    setThemeSuggestion,
    tickerAlerts,
    setTickerAlerts,
    selectedTickerIds,
    setSelectedTickerIds,
    showBulkAlertPopover,
    setShowBulkAlertPopover,
    handleBulkAlertAction,
    theme,
    handleSetTheme,
    notifications,
    handleMarkAllNotificationsRead,
    handleMarkNotificationRead,
    handleClearAllNotifications,
    handleSignalRAlert,
    handleExecuteCommandFromPalette,
    searchResults,
    hasSearchResults,
    isSystemFrozen,
    setIsSystemFrozen,
    uiDensity,
  } = useSupportPilot();

  const [isFreezeModalOpen, setIsFreezeModalOpen] = useState(false);

  // Search usage metrics hook
  const { metrics: searchMetrics, trackQuery, trackClick, resetMetrics } = useSearchMetrics();

  // Search category filter state
  const [searchCategoryFilter, setSearchCategoryFilter] = useState<'All' | 'Incidents' | 'Runbooks' | 'Audit'>('All');

  // Keyboard navigation index in search results
  const [focusedSearchIndex, setFocusedSearchIndex] = useState<number>(-1);

  // Saved Searches state with localStorage persistence
  const [savedSearches, setSavedSearches] = useState<Array<{
    id: string;
    query: string;
    category: 'All' | 'Incidents' | 'Runbooks' | 'Audit';
    savedAt: string;
  }>>(() => {
    try {
      const saved = localStorage.getItem('supportpilot_saved_searches');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved searches', e);
    }
    return [
      { id: 'save_1', query: 'K8s OOMKilled', category: 'Incidents', savedAt: '10:15 AM' },
      { id: 'save_2', query: 'PostgreSQL', category: 'All', savedAt: '11:20 AM' }
    ];
  });

  // Check if current search query and category filter combination is saved
  const isCurrentSearchSaved = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return false;
    return savedSearches.some(s => s.query.toLowerCase() === q && s.category === searchCategoryFilter);
  }, [searchQuery, searchCategoryFilter, savedSearches]);

  const toggleSaveSearch = () => {
    const q = searchQuery.trim();
    if (!q) return;

    if (isCurrentSearchSaved) {
      setSavedSearches(prev => {
        const updated = prev.filter(s => !(s.query.toLowerCase() === q.toLowerCase() && s.category === searchCategoryFilter));
        try {
          localStorage.setItem('supportpilot_saved_searches', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
      setToastMessage(`Removed bookmark for: "${q}"`);
    } else {
      const newSave = {
        id: `save_${Date.now()}`,
        query: q,
        category: searchCategoryFilter,
        savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setSavedSearches(prev => {
        const updated = [newSave, ...prev];
        try {
          localStorage.setItem('supportpilot_saved_searches', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
      setToastMessage(`Saved search query: "${q}" [${searchCategoryFilter}]`);
    }
  };

  const removeSavedSearch = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSavedSearches(prev => {
      const updated = prev.filter(s => s.id !== id);
      try {
        localStorage.setItem('supportpilot_saved_searches', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  // Archived Logs toggle & simulation state
  const [includeArchivedLogs, setIncludeArchivedLogs] = useState<boolean>(false);
  const [isFetchingArchived, setIsFetchingArchived] = useState<boolean>(false);

  const handleToggleArchived = (enabled: boolean) => {
    setIncludeArchivedLogs(enabled);
    if (enabled) {
      setIsFetchingArchived(true);
      setTimeout(() => {
        setIsFetchingArchived(false);
        setToastMessage('Fetched historical cold storage archive records.');
      }, 450);
    }
  };

  // Preview Mode Hover Item State
  const [hoveredPreviewItem, setHoveredPreviewItem] = useState<{
    id: string;
    type: 'incident' | 'runbook' | 'audit';
    title: string;
    subtitle: string;
    badge?: string;
    isArchived?: boolean;
    onClick: () => void;
  } | null>(null);

  // Recent searches state with localStorage persistence
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('supportpilot_recent_searches');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse recent searches', e);
    }
    return ['PostgreSQL', 'K8s OOMKilled', 'Circuit Breaker', 'Audit', '502 Bad Gateway'];
  });

  const addRecentSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(q => q.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 5);
      try {
        localStorage.setItem('supportpilot_recent_searches', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save recent searches', e);
      }
      return updated;
    });
  };

  const removeRecentSearch = (query: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRecentSearches(prev => {
      const updated = prev.filter(q => q !== query);
      try {
        localStorage.setItem('supportpilot_recent_searches', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save recent searches', e);
      }
      return updated;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('supportpilot_recent_searches');
    } catch (e) {}
  };

  // Search UI sound effects state & synth trigger
  const [searchSoundEnabled, setSearchSoundEnabled] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem('supportpilot_search_sound');
      return val !== null ? JSON.parse(val) : true;
    } catch (e) {
      return true;
    }
  });

  const handleSetSearchSoundEnabled = (enabled: boolean) => {
    setSearchSoundEnabled(enabled);
    try {
      localStorage.setItem('supportpilot_search_sound', JSON.stringify(enabled));
    } catch (e) {}
    setToastMessage(enabled ? 'Search UI sound effects enabled.' : 'Search UI sound effects muted.');
  };

  const playSearchPingSound = React.useCallback(() => {
    if (!searchSoundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1318.5, ctx.currentTime + 0.06);

      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {
      // Ignore web audio limitations
    }
  }, [searchSoundEnabled]);

  // Sort By state for search results
  const [sortBy, setSortBy] = useState<'relevance' | 'newest' | 'severity'>('relevance');

  // Time Range filter state for search results
  const [searchTimeRange, setSearchTimeRange] = useState<'all' | '1h' | '24h' | '7d'>('all');

  // Dedicated Severity filter state for search results
  const [searchSeverityFilter, setSearchSeverityFilter] = useState<'all' | 'SEV-1' | 'SEV-2' | 'SEV-3' | 'SEV-4'>('all');

  // Group By Severity state for search results
  const [groupBySeverity, setGroupBySeverity] = useState<boolean>(false);
  const [collapsedSeverities, setCollapsedSeverities] = useState<Record<string, boolean>>({});

  const isAllSeveritiesCollapsed = (['SEV-1', 'SEV-2', 'SEV-3', 'SEV-4'] as const).every(sev => !!collapsedSeverities[sev]);

  const handleToggleAllSeverities = () => {
    const target = !isAllSeveritiesCollapsed;
    setCollapsedSeverities({
      'SEV-1': target,
      'SEV-2': target,
      'SEV-3': target,
      'SEV-4': target,
    });
  };

  // Mark as read state for search result items
  const [readItemIds, setReadItemIds] = useState<string[]>([]);

  const toggleReadItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isCurrentlyRead = readItemIds.includes(id);
    setReadItemIds(prev =>
      isCurrentlyRead ? prev.filter(x => x !== id) : [...prev, id]
    );
    setToastMessage(isCurrentlyRead ? `Marked item ${id} as unread.` : `Marked item ${id} as reviewed/read.`);
  };

  // Quick notes state for search result items
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [editingNoteItemId, setEditingNoteItemId] = useState<string | null>(null);

  // Show Meta toggle state for technical metadata
  const [showMeta, setShowMeta] = useState<boolean>(false);

  // Bulk incident selection state
  const [selectedIncidentIds, setSelectedIncidentIds] = useState<string[]>([]);

  const toggleSeverityGroup = (sev: string) => {
    setCollapsedSeverities(prev => ({ ...prev, [sev]: !prev[sev] }));
  };

  const handleCopyResultLink = (item: { id: string; title: string; type: string }, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/#${item.type}/${item.id}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url);
    }
    setToastMessage(`Copied deep link for "${item.title}" to clipboard!`);
  };

  const handleShareResultLink = (item: { id: string; title: string; type: string }, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/#${item.type}/${item.id}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: item.title,
        text: `Check out ${item.type} ${item.id}: ${item.title}`,
        url: url,
      }).catch(() => {});
    } else {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url);
      }
      setToastMessage(`Shared deep link for "${item.title}"! (Copied to clipboard)`);
    }
  };

  const getTechnicalMeta = (id: string, type: string) => {
    if (type === 'incident') {
      return {
        source: id.includes('89') || id.includes('arch') ? 'Cloud Vault Storage' : 'K8s Cluster Monitor',
        lastUpdated: '2m ago',
        confidence: '98%'
      };
    }
    if (type === 'runbook') {
      return {
        source: 'Knowledge Base Master',
        lastUpdated: '1d ago',
        confidence: '95%'
      };
    }
    return {
      source: 'Immutable Audit Stream',
      lastUpdated: 'Just now',
      confidence: '100%'
    };
  };

  const getStatusBadge = (item: { id: string; type: string; severity?: string; isArchived?: boolean }) => {
    if (item.type === 'incident') {
      if (item.isArchived) return { label: 'Archived', color: 'text-purple-300 bg-purple-950/80 border-purple-800/60' };
      if (item.severity === 'SEV-1') return { label: 'Active', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
      if (item.severity === 'SEV-2') return { label: 'Investigating', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
      return { label: 'Resolved', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    }
    if (item.type === 'runbook') {
      if (item.id.includes('01') || item.id.includes('02')) return { label: 'Verified', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
      return { label: 'Draft', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' };
    }
    return { label: 'Audited', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' };
  };

  // Track search query volume on search change
  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      trackQuery(searchQuery);
    }
  }, [searchQuery, trackQuery]);

  // Simulated archived historical records
  const archivedIncidents = useMemo(() => {
    if (!includeArchivedLogs) return [];
    const q = searchQuery.toLowerCase();
    const list = [
      {
        id: 'arch_inc_088',
        title: 'Archived: S3 Bucket Cross-Region Replication Lag (Cold Vault)',
        description: 'Historical S3 replication buffer bottleneck during Q2 backup migration.',
        severity: 'SEV-3',
        isArchived: true
      },
      {
        id: 'arch_inc_089',
        title: 'Archived: Legacy PostgreSQL Table Lock on Billing Audit',
        description: 'Historical database deadlock resolved by query indexing patch v1.4.2.',
        severity: 'SEV-2',
        isArchived: true
      }
    ];
    if (!q.trim()) return list;
    return list.filter(i => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
  }, [includeArchivedLogs, searchQuery]);

  const archivedAudits = useMemo(() => {
    if (!includeArchivedLogs) return [];
    const q = searchQuery.toLowerCase();
    const list = [
      {
        id: 'arch_aud_042',
        action: 'ARCHIVED_COMPLIANCE_PURGE',
        payload: 'Cold storage retention policy applied for 2025 system logs.',
        isArchived: true
      }
    ];
    if (!q.trim()) return list;
    return list.filter(a => a.action.toLowerCase().includes(q) || a.payload.toLowerCase().includes(q) || a.id.toLowerCase().includes(q));
  }, [includeArchivedLogs, searchQuery]);

  // Category-filtered search results lists (including archived if toggled)
  const filteredIncidents = useMemo(() => {
    const base = (searchCategoryFilter === 'All' || searchCategoryFilter === 'Incidents') ? searchResults.incidents : [];
    let list = [...base, ...archivedIncidents];
    if (searchSeverityFilter !== 'all') {
      list = list.filter(inc => inc.severity === searchSeverityFilter);
    }
    return list;
  }, [searchCategoryFilter, searchResults.incidents, archivedIncidents, searchSeverityFilter]);

  const filteredRunbooks = (searchCategoryFilter === 'All' || searchCategoryFilter === 'Runbooks') ? searchResults.runbooks : [];

  const filteredAudits = useMemo(() => {
    const base = (searchCategoryFilter === 'All' || searchCategoryFilter === 'Audit') ? searchResults.audits : [];
    return [...base, ...archivedAudits];
  }, [searchCategoryFilter, searchResults.audits, archivedAudits]);

  // Bulk incidents select helpers
  const allIncidentIds = useMemo(() => filteredIncidents.map(i => i.id), [filteredIncidents]);
  const isAllIncidentsSelected = allIncidentIds.length > 0 && selectedIncidentIds.length === allIncidentIds.length;

  const toggleSelectAllIncidents = () => {
    if (isAllIncidentsSelected) {
      setSelectedIncidentIds([]);
    } else {
      setSelectedIncidentIds(allIncidentIds);
    }
  };

  const toggleSelectIncident = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIncidentIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkAssignIncidents = () => {
    if (selectedIncidentIds.length === 0) return;
    const count = selectedIncidentIds.length;
    handleAddAuditLog(
      'SystemOperator',
      'BULK_INCIDENT_ASSIGN',
      'WORKSPACE_ROUTER',
      'SUCCESS',
      `Assigned ${count} incident(s) (${selectedIncidentIds.join(', ')}) to Senior On-Call Engineer.`
    );
    setToastMessage(`Bulk assigned ${count} incident(s) to Senior On-Call Engineer.`);
    setSelectedIncidentIds([]);
  };

  const handleBulkArchiveIncidents = () => {
    if (selectedIncidentIds.length === 0) return;
    const count = selectedIncidentIds.length;
    handleAddAuditLog(
      'SystemOperator',
      'BULK_INCIDENT_ARCHIVE',
      'COLD_VAULT',
      'SUCCESS',
      `Archived ${count} incident(s) (${selectedIncidentIds.join(', ')}) to cold storage vault.`
    );
    setToastMessage(`Bulk archived ${count} incident(s) to cold storage vault.`);
    setSelectedIncidentIds([]);
  };

  // Simulated AI context-aware Related Queries
  const relatedQueries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return [
        'PostgreSQL connection pool exhaustion',
        'K8s Pod OOMKilled recovery',
        'Audit log compliance purge'
      ];
    }
    if (q.includes('postgre') || q.includes('sql') || q.includes('db')) {
      return [
        'PostgreSQL table lock deadlock runbook',
        'DB connection pool max limits',
        'Read replica replication lag'
      ];
    }
    if (q.includes('k8s') || q.includes('pod') || q.includes('oom') || q.includes('container')) {
      return [
        'K8s memory request vs limit settings',
        'CrashLoopBackOff container logs',
        'Horizontal Pod Autoscaler metrics'
      ];
    }
    if (q.includes('s3') || q.includes('vault') || q.includes('storage') || q.includes('archive')) {
      return [
        'S3 cross-region replication status',
        'Cold vault retention rules',
        'Bucket access audit trails'
      ];
    }
    if (q.includes('audit') || q.includes('log') || q.includes('purge') || q.includes('event')) {
      return [
        'Immutable audit log export',
        'Compliance retention policy',
        'Security group ingress changes'
      ];
    }
    return [
      `${searchQuery} root cause postmortem`,
      `${searchQuery} diagnostic runbook`,
      `${searchQuery} error rate telemetry`
    ];
  }, [searchQuery]);

  // Flat array of search results for sequential keyboard navigation & shortcut hints
  const flatSearchResults = useMemo(() => {
    let flat: Array<{
      id: string;
      type: 'incident' | 'runbook' | 'audit';
      title: string;
      subtitle: string;
      badge?: string;
      isArchived?: boolean;
      onClick: () => void;
    }> = [];

    filteredIncidents.forEach(inc => {
      flat.push({
        id: `inc-${inc.id}`,
        type: 'incident',
        title: inc.title,
        subtitle: inc.description,
        badge: inc.severity,
        isArchived: (inc as any).isArchived,
        onClick: () => {
          setActiveTab('workspace');
          setShowSearchPreview(false);
          setToastMessage(`Focused workspace context on: ${inc.id}`);
          addRecentSearch(inc.title || searchQuery);
          trackClick();
        }
      });
    });

    filteredRunbooks.forEach(kb => {
      flat.push({
        id: `kb-${kb.id}`,
        type: 'runbook',
        title: kb.title,
        subtitle: kb.tags ? kb.tags.join(', ') : kb.id,
        badge: kb.id,
        onClick: () => {
          setSelectedSearchRunbook(kb);
          setShowSearchPreview(false);
          addRecentSearch(kb.title || searchQuery);
          trackClick();
        }
      });
    });

    filteredAudits.forEach(aud => {
      flat.push({
        id: `aud-${aud.id}`,
        type: 'audit',
        title: aud.action,
        subtitle: aud.payload,
        badge: aud.id,
        isArchived: (aud as any).isArchived,
        onClick: () => {
          setActiveTab('audit');
          setShowSearchPreview(false);
          setToastMessage(`Navigated to Audit Panel for event: ${aud.id}`);
          addRecentSearch(aud.action || searchQuery);
          trackClick();
        }
      });
    });

    // Apply Severity filtering
    if (searchSeverityFilter !== 'all') {
      flat = flat.filter(item => item.type === 'incident' && item.badge === searchSeverityFilter);
    }

    // Apply Time Range filtering
    if (searchTimeRange !== 'all') {
      const maxHours = searchTimeRange === '1h' ? 1 : searchTimeRange === '24h' ? 24 : 168;
      const getItemHoursAgo = (id: string): number => {
        if (id.includes('8902') || id.includes('109') || id.includes('101')) return 0.4;
        if (id.includes('8901') || id.includes('108') || id.includes('102') || id.includes('8900')) return 8;
        if (id.includes('088') || id.includes('107') || id.includes('103')) return 48;
        if (id.includes('089') || id.includes('042')) return 200;
        let num = 0;
        for (let i = 0; i < id.length; i++) num += id.charCodeAt(i);
        return (num % 120) + 0.2;
      };
      flat = flat.filter(item => getItemHoursAgo(item.id) <= maxHours);
    }

    // Apply Sort By sorting rules
    if (sortBy === 'severity') {
      const sevRank = (b?: string) => {
        if (b === 'SEV-1') return 1;
        if (b === 'SEV-2') return 2;
        if (b === 'SEV-3') return 3;
        if (b === 'SEV-4') return 4;
        return 5;
      };
      flat.sort((a, b) => sevRank(a.badge) - sevRank(b.badge));
    } else if (sortBy === 'newest') {
      flat.sort((a, b) => b.id.localeCompare(a.id));
    } else if (sortBy === 'relevance' && searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      flat.sort((a, b) => {
        const aMatch = a.title.toLowerCase().startsWith(q) ? 2 : a.title.toLowerCase().includes(q) ? 1 : 0;
        const bMatch = b.title.toLowerCase().startsWith(q) ? 2 : b.title.toLowerCase().includes(q) ? 1 : 0;
        return bMatch - aMatch;
      });
    }

    return flat;
  }, [filteredIncidents, filteredRunbooks, filteredAudits, searchQuery, sortBy, searchTimeRange, searchSeverityFilter, setActiveTab, setShowSearchPreview, setToastMessage, setSelectedSearchRunbook, trackClick]);

  // Audio ping trigger on search result load/change
  useEffect(() => {
    if (showSearchPreview && flatSearchResults.length > 0) {
      playSearchPingSound();
    }
  }, [showSearchPreview, searchQuery, searchCategoryFilter, includeArchivedLogs, playSearchPingSound, flatSearchResults.length]);

  // CSV Export handler
  const handleExportSearchCSV = () => {
    if (flatSearchResults.length === 0) {
      setToastMessage('No search results available to export.');
      return;
    }

    const headers = ['Type', 'ID', 'Title', 'Subtitle/Payload', 'Badge/Severity'];
    const csvRows = [headers.join(',')];

    flatSearchResults.forEach(item => {
      const type = `"${item.type.toUpperCase()}"`;
      const id = `"${item.id.replace(/"/g, '""')}"`;
      const title = `"${(item.title || '').replace(/"/g, '""')}"`;
      const subtitle = `"${(item.subtitle || '').replace(/"/g, '""')}"`;
      const badge = `"${(item.badge || '').replace(/"/g, '""')}"`;
      csvRows.push([type, id, title, subtitle, badge].join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `supportpilot_search_${searchCategoryFilter.toLowerCase()}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    handleAddAuditLog(
      'SystemOperator',
      'SEARCH_EXPORT_CSV',
      'SEARCH_ENGINE',
      'SUCCESS',
      `Exported ${flatSearchResults.length} search records to CSV [Category: ${searchCategoryFilter}, Query: "${searchQuery || '*'}"]`
    );

    setToastMessage(`Exported ${flatSearchResults.length} records to CSV file.`);
  };

  // Reset focus index when search query or category filter changes
  useEffect(() => {
    setFocusedSearchIndex(-1);
    setHoveredPreviewItem(null);
  }, [searchQuery, searchCategoryFilter]);

  // Keyboard navigation handler for search input (ArrowUp/Down, Enter, Esc, 1-9 shortcuts)
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSearchPreview) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setShowSearchPreview(true);
      }
      return;
    }

    // Direct numeric keypresses (1-9) to quickly select item
    if (e.key >= '1' && e.key <= '9' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < flatSearchResults.length) {
        e.preventDefault();
        flatSearchResults[idx].onClick();
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatSearchResults.length === 0) return;
      setFocusedSearchIndex(prev => {
        const nextIdx = prev < flatSearchResults.length - 1 ? prev + 1 : 0;
        setHoveredPreviewItem(flatSearchResults[nextIdx] || null);
        return nextIdx;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatSearchResults.length === 0) return;
      setFocusedSearchIndex(prev => {
        const nextIdx = prev > 0 ? prev - 1 : flatSearchResults.length - 1;
        setHoveredPreviewItem(flatSearchResults[nextIdx] || null);
        return nextIdx;
      });
    } else if (e.key === 'Enter') {
      if (focusedSearchIndex >= 0 && focusedSearchIndex < flatSearchResults.length) {
        e.preventDefault();
        flatSearchResults[focusedSearchIndex].onClick();
      } else if (searchQuery.trim()) {
        addRecentSearch(searchQuery);
      }
    } else if (e.key === 'Escape') {
      setShowSearchPreview(false);
    }
  };

  // Global fetch interceptor to suspend non-critical API requests during Emergency Freeze
  useEffect(() => {
    if (isSystemFrozen) {
      const originalFetch = window.fetch;
      window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);
        // /api/health and any local/frozen system controls should bypass
        if (url.includes('/api/health') || url.includes('/api/freeze')) {
          return originalFetch(input, init);
        }
        
        console.warn(`[EMERGENCY SYSTEM FREEZE] Suspended non-critical API call: ${url}`);
        
        return new Response(JSON.stringify({
          error: "Emergency System Freeze Active",
          message: "All non-critical API calls have been suspended by administrative command."
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      };
      
      return () => {
        window.fetch = originalFetch;
      };
    }
  }, [isSystemFrozen]);

  // Navigation Items definitions for icons
  const navigationItems = useMemo(() => [
    { id: 'workspace', label: 'Incident Workspace', icon: Icons.Terminal },
    { id: 'agents', label: 'AI Agent Matrix', icon: Icons.Bot },
    { id: 'metrics', label: 'NOC & SLA Dashboard', icon: Icons.Zap },
    { id: 'runbooks', label: 'Knowledge Base', icon: Icons.BookOpen },
    { id: 'settings', label: 'System Settings', icon: Icons.Settings },
    { id: 'audit', label: 'Audit & Index', icon: Icons.Shield },
    { id: 'aspnet', label: 'C# ASP.NET Engine', icon: Icons.Server }
  ], []);

  // Width calculations for high-fidelity animations
  const sidebarExpandedWidth = 260;
  const sidebarSlimWidth = 68;
  const sidebarHiddenWidth = 0;

  // Spacing width reserved in layout (so sidebar does not overlay content if pinned)
  const layoutSpacerWidth = isPinned 
    ? sidebarExpandedWidth 
    : (sidebarMode === 'slim' ? sidebarSlimWidth : sidebarHiddenWidth);

  // Active hover or expanded width
  const isCurrentlyExpanded = isPinned || isHovered;
  
  // Calculate animating width and x positions for premium slide-out and slim actions
  const sidebarDisplayWidth = (sidebarMode === 'hidden' && !isCurrentlyExpanded) 
    ? sidebarExpandedWidth 
    : (isCurrentlyExpanded ? sidebarExpandedWidth : sidebarSlimWidth);

  const sidebarDisplayX = (!isCurrentlyExpanded && sidebarMode === 'hidden')
    ? -sidebarExpandedWidth
    : 0;

  // Find active tab info for breadcrumbs
  const activeTabItem = navigationItems.find(item => item.id === activeTab);
  const ActiveTabIcon = activeTabItem?.icon || Icons.Terminal;

  return (
    <div className="flex h-screen w-screen bg-slate-950 font-sans text-slate-100 select-none overflow-hidden">
      
      {/* STEALTH SIDEBAR TRIGGER ZONE */}
      {!isPinned && sidebarMode === 'hidden' && !isHovered && (
        <div 
          className="fixed left-0 top-0 bottom-0 w-4 z-50 cursor-col-resize bg-transparent hover:bg-indigo-600/10 border-r border-dashed border-indigo-500/10 transition-colors"
          onMouseEnter={() => setIsHovered(true)}
          title="Hover to slide out control sidebar"
        />
      )}

      {/* DYNAMIC SIDE MENU CONTAINER */}
      <motion.aside
        onMouseEnter={() => { if (!isPinned) setIsHovered(true); }}
        onMouseLeave={() => { if (!isPinned) setIsHovered(false); }}
        animate={{ 
          width: sidebarDisplayWidth,
          x: sidebarDisplayX
        }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className={`fixed left-0 top-0 bottom-0 z-40 flex flex-col border-r border-slate-900 bg-slate-950/95 backdrop-blur-xl transition-all duration-150 ${
          isCurrentlyExpanded ? 'shadow-2xl shadow-indigo-950/20' : ''
        } ${!isPinned && isHovered ? 'ring-1 ring-indigo-500/10' : ''}`}
      >
        {/* LOGO & BRANDING BAR */}
        <div className="flex h-14 items-center justify-between border-b border-slate-900 px-4">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 font-display font-black text-white text-base shadow-lg shadow-indigo-600/30">
              S
            </div>
            {isCurrentlyExpanded && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col whitespace-nowrap"
              >
                <div className="flex items-center space-x-1.5">
                  <span className="font-display font-black tracking-wider text-white text-xs">SUPPORTPILOT</span>
                  <span className="rounded bg-indigo-500/10 px-1 py-0.2 font-mono text-[7px] font-bold text-indigo-400 border border-indigo-500/20">
                    ENT
                  </span>
                </div>
                <div className="flex items-center space-x-1 text-[8px] text-slate-500 font-mono">
                  <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                  <span>K8S_NODE: ACTIVE</span>
                </div>
              </motion.div>
            )}
          </div>

          {/* Quick pin / collapse action */}
          {isCurrentlyExpanded && (
            <button
              onClick={() => setIsPinned(!isPinned)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-900 hover:text-white transition-all cursor-pointer"
              title={isPinned ? "Unpin sidebar (Enable Auto-Hide)" : "Pin sidebar to layout"}
            >
              {isPinned ? (
                <Icons.Pin className="h-4 w-4 text-indigo-400" />
              ) : (
                <Icons.PinOff className="h-4 w-4 rotate-45" />
              )}
            </button>
          )}
        </div>

        {/* MEMOIZED NAVIGATION LIST */}
        <SidebarNavigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isCurrentlyExpanded={isCurrentlyExpanded}
          isPinned={isPinned}
          setIsHovered={setIsHovered}
        />

        {/* SIDEBAR PREFERENCE SETTINGS CONTROL PANEL */}
        <div className="border-t border-slate-900/80 p-2.5 bg-slate-950">
          <div className="flex items-center justify-around rounded-xl bg-slate-900/40 p-1 border border-slate-900/60 mb-2">
            <button
              onClick={() => setSidebarMode('slim')}
              className={`flex-1 flex justify-center py-1 rounded-lg transition-all cursor-pointer ${
                sidebarMode === 'slim' 
                  ? 'bg-slate-800 text-indigo-400 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Set Auto-Hide Mode to Docked Slim Strip"
            >
              <Icons.Menu className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setSidebarMode('hidden')}
              className={`flex-1 flex justify-center py-1 rounded-lg transition-all cursor-pointer ${
                sidebarMode === 'hidden' 
                  ? 'bg-slate-800 text-indigo-400 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Set Auto-Hide Mode to Fully Hidden"
            >
              <Icons.EyeOff className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setIsPinned(!isPinned)}
              className={`flex-1 flex justify-center py-1 rounded-lg transition-all cursor-pointer ${
                isPinned 
                  ? 'bg-indigo-600/20 text-indigo-400' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title={isPinned ? "Sidebar Pinned" : "Sidebar Auto-Hiding"}
            >
              <Icons.Lock className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* ACTIVE USER SUMMARY COMPONENT */}
          <div className="flex items-center justify-between rounded-xl p-1.5 hover:bg-slate-900/40 transition-colors">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="relative rounded-lg bg-slate-900 p-2 border border-slate-800 shrink-0">
                <Icons.User className="h-4 w-4 text-slate-400" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 border-2 border-slate-950" />
              </div>
              {isCurrentlyExpanded && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-left min-w-0 overflow-hidden"
                >
                  <div className="font-bold text-white text-xxs truncate">{ActiveUser.name}</div>
                  <div className="text-[9px] font-mono text-indigo-400 truncate">{ActiveUser.role}</div>
                </motion.div>
              )}
            </div>

            {isCurrentlyExpanded && (
              <motion.button 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => {
                  setIsLocked(true);
                  handleAddAuditLog(
                    "Eshan Barua (CTO)", 
                    "Manual Session Lock", 
                    "Compliance Engine", 
                    "SUCCESS", 
                    "Operator manually locked the operational session for physical workspace security."
                  );
                }}
                className="text-slate-500 hover:text-indigo-400 p-1 rounded-lg hover:bg-slate-900 cursor-pointer"
                title="Secure Terminal Session"
              >
                <Icons.Power className="h-3.5 w-3.5" />
              </motion.button>
            )}
          </div>
        </div>
      </motion.aside>

      {/* DYNAMIC PUSH-BACK SPACER */}
      <motion.div 
        animate={{ width: layoutSpacerWidth }}
        transition={{ type: 'spring', stiffness: 350, damping: 32 }}
        className="shrink-0 h-full hidden md:block"
      />

      {/* MAIN CONTENT AREA CONTAINER */}
      <div className="flex-1 h-full overflow-hidden flex flex-col min-w-0">
        
        {/* POLISHED ENTERPRISE SUB-HEADER */}
        <header className={`flex shrink-0 items-center justify-between border-b border-slate-900 bg-slate-950/80 backdrop-blur-md transition-all duration-300 ${uiDensity === 'compact' ? 'h-11 px-4' : 'h-16 px-8'}`}>
          <div className="flex items-center space-x-4 text-xs">
            <div className="flex items-center space-x-2.5">
              <Icons.Layers className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-slate-500 font-medium font-display">cluster-prod-1</span>
              <Icons.ChevronRight className="h-3 w-3 text-slate-600" />
              <div className="flex items-center space-x-1.5 text-white font-semibold font-display">
                <ActiveTabIcon className="h-3.5 w-3.5 text-indigo-400" />
                <span>{activeTabItem?.label}</span>
              </div>
            </div>

            <div className="h-4 w-[1px] bg-slate-800 hidden lg:block" />

            {/* Security Auto-Lock Countdown Progress Indicator */}
            <div className="hidden lg:flex items-center space-x-2.5 rounded-lg border border-slate-900 bg-slate-900/35 px-2.5 py-1.5 font-mono text-[10px] text-slate-400 select-none">
              <Icons.ShieldAlert className={`h-3.5 w-3.5 text-indigo-400 ${secondsRemaining < 60 ? 'animate-pulse text-rose-500' : ''}`} />
              <div className="flex flex-col">
                <div className="flex items-center justify-between space-x-2 text-[8px] font-bold text-slate-500 leading-none mb-1">
                  <span>AUTO-LOCK</span>
                  <span className={secondsRemaining < 60 ? 'text-rose-400 font-bold animate-pulse' : 'text-slate-400'}>
                    {Math.floor(secondsRemaining / 60)}:{(secondsRemaining % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                <div className="h-1 w-20 rounded-full bg-slate-950 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${secondsRemaining < 60 ? 'bg-rose-500' : 'bg-indigo-500'}`}
                    style={{ width: `${(secondsRemaining / 900) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="h-4 w-[1px] bg-slate-800 hidden xl:block" />

            {/* Persistent 'Incident Health Bar' sparkline */}
            <div className="hidden xl:flex items-center space-x-3 rounded-lg border border-slate-900 bg-slate-900/35 px-2.5 py-1 font-mono text-[10px] text-slate-400 select-none">
              <div className="text-left">
                <div className="text-[8px] font-bold text-slate-500 uppercase leading-none mb-0.5">Incident Health (1h)</div>
                <div className="flex items-center space-x-1 leading-none">
                  <span className="text-white font-bold font-display text-[10px]">7</span>
                  <span className="text-[7.5px] text-rose-400 font-semibold uppercase leading-none">inc/hr</span>
                </div>
              </div>
              <div className="w-16 h-5 relative flex items-center">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 70 20">
                  <defs>
                    <linearGradient id="header-spark-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 5,15 Q 15,5 25,12 T 45,7 T 65,11 L 65,20 L 5,20 Z"
                    fill="url(#header-spark-grad)"
                    stroke="none"
                  />
                  <path
                    d="M 5,15 Q 15,5 25,12 T 45,7 T 65,11"
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                  <circle cx="65" cy="11" r="1.5" fill="#f43f5e" />
                  <circle cx="65" cy="11" r="3" fill="#f43f5e" className="animate-ping" opacity="0.3" />
                </svg>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Unified Full-Text Search Bar */}
            <div className="relative hidden md:block w-72">
              <div className="relative flex items-center">
                <Icons.Search className="absolute left-3 h-4 w-4 text-slate-500" />
                <input
                  id="unified-search-input"
                  type="text"
                  placeholder="Index tickets, runbooks, logs... (Alt+F)"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchPreview(true);
                  }}
                  onFocus={() => setShowSearchPreview(true)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full rounded-xl border border-slate-900 bg-slate-950 py-2 pl-9 pr-14 text-xxs text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono animate-none"
                />
                <div className="absolute right-2 flex items-center space-x-1">
                  {/* Save Query Star Icon */}
                  {searchQuery.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={toggleSaveSearch}
                      className={`p-1 transition-colors cursor-pointer rounded hover:bg-slate-900 ${
                        isCurrentSearchSaved
                          ? 'text-amber-400'
                          : 'text-slate-500 hover:text-amber-400'
                      }`}
                      title={isCurrentSearchSaved ? 'Bookmark active (Click to remove)' : 'Save query and active category filter'}
                    >
                      <Icons.Star className={`h-3.5 w-3.5 ${isCurrentSearchSaved ? 'fill-amber-400' : ''}`} />
                    </button>
                  )}
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-slate-500 hover:text-slate-300 p-0.5"
                      title="Clear search"
                    >
                      <Icons.X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Search Preview Overlay Dropdown */}
              <AnimatePresence>
                {showSearchPreview && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowSearchPreview(false)} 
                    />
                    <motion.div
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      variants={{
                        hidden: { opacity: 0, y: 8 },
                        visible: {
                          opacity: 1,
                          y: 0,
                          transition: { duration: 0.2, staggerChildren: 0.03 }
                        },
                        exit: { opacity: 0, y: 8, transition: { duration: 0.15 } }
                      }}
                      className="absolute right-0 mt-2 z-50 rounded-xl border border-slate-900 bg-slate-950 p-3.5 shadow-2xl backdrop-blur-xl max-h-[500px] overflow-y-auto font-mono text-[10px] w-[360px] md:w-[680px]"
                    >
                      {/* TOP CONTROL BAR: HEADER, ARCHIVE TOGGLE & EXPORT CSV */}
                      <div className="flex flex-wrap items-center justify-between border-b border-slate-900/80 pb-2 mb-2.5 gap-2">
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-1.5">
                            <Icons.Search className="h-3 w-3 text-indigo-400" />
                            <span className="text-slate-300 font-bold tracking-wider text-[8.5px] uppercase">Search Index Results</span>
                          </div>
                          <span className="text-[8px] text-slate-500 font-mono">
                            ({flatSearchResults.length} hits)
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          {/* Sort By Dropdown */}
                          <div className="flex items-center space-x-1 text-[8px] font-mono font-bold text-slate-400 bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
                            <Icons.ArrowUpDown className="h-2.5 w-2.5 text-indigo-400 shrink-0" />
                            <span>Sort:</span>
                            <select
                              value={sortBy}
                              onChange={(e) => setSortBy(e.target.value as 'relevance' | 'newest' | 'severity')}
                              className="bg-transparent text-indigo-300 font-bold focus:outline-none cursor-pointer text-[8px]"
                            >
                              <option value="relevance" className="bg-slate-950 text-slate-200">Relevance</option>
                              <option value="newest" className="bg-slate-950 text-slate-200">Newest</option>
                              <option value="severity" className="bg-slate-950 text-slate-200">Severity</option>
                            </select>
                          </div>

                          {/* Time Range Filter Dropdown */}
                          <div className="flex items-center space-x-1 text-[8px] font-mono font-bold text-slate-400 bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
                            <Icons.Clock className="h-2.5 w-2.5 text-indigo-400 shrink-0" />
                            <span>Time:</span>
                            <select
                              value={searchTimeRange}
                              onChange={(e) => setSearchTimeRange(e.target.value as 'all' | '1h' | '24h' | '7d')}
                              className="bg-transparent text-indigo-300 font-bold focus:outline-none cursor-pointer text-[8px]"
                            >
                              <option value="all" className="bg-slate-950 text-slate-200">All Time</option>
                              <option value="1h" className="bg-slate-950 text-slate-200">Last 1 Hour</option>
                              <option value="24h" className="bg-slate-950 text-slate-200">Last 24 Hours</option>
                              <option value="7d" className="bg-slate-950 text-slate-200">Last 7 Days</option>
                            </select>
                          </div>

                          {/* Dedicated Severity Filter Dropdown */}
                          <div className="flex items-center space-x-1 text-[8px] font-mono font-bold text-slate-400 bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
                            <Icons.AlertTriangle className="h-2.5 w-2.5 text-rose-400 shrink-0" />
                            <span>Severity:</span>
                            <select
                              value={searchSeverityFilter}
                              onChange={(e) => setSearchSeverityFilter(e.target.value as 'all' | 'SEV-1' | 'SEV-2' | 'SEV-3' | 'SEV-4')}
                              className="bg-transparent text-rose-300 font-bold focus:outline-none cursor-pointer text-[8px]"
                            >
                              <option value="all" className="bg-slate-950 text-slate-200">All Severities</option>
                              <option value="SEV-1" className="bg-slate-950 text-rose-300 font-bold">SEV-1</option>
                              <option value="SEV-2" className="bg-slate-950 text-amber-300 font-bold">SEV-2</option>
                              <option value="SEV-3" className="bg-slate-950 text-yellow-300 font-bold">SEV-3</option>
                              <option value="SEV-4" className="bg-slate-950 text-slate-300 font-bold">SEV-4</option>
                            </select>
                          </div>

                          {/* Group By Severity Toggle */}
                          <div className="flex items-center space-x-1.5 bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
                            <label className="flex items-center space-x-1 text-[8px] font-mono font-bold cursor-pointer text-slate-400 hover:text-slate-200">
                              <input
                                type="checkbox"
                                checked={groupBySeverity}
                                onChange={(e) => setGroupBySeverity(e.target.checked)}
                                className="rounded bg-slate-950 border-slate-700 text-rose-500 focus:ring-0 h-3 w-3 cursor-pointer"
                              />
                              <span className="flex items-center space-x-1">
                                <Icons.Layers className="h-2.5 w-2.5 text-rose-400" />
                                <span>Group By Severity</span>
                              </span>
                            </label>

                            {groupBySeverity && (
                              <button
                                type="button"
                                onClick={handleToggleAllSeverities}
                                className="ml-1.5 px-1.5 py-0.5 rounded text-[7.5px] font-mono font-bold bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 cursor-pointer flex items-center space-x-1 transition-all"
                                title={isAllSeveritiesCollapsed ? "Expand all severity groups" : "Collapse all severity groups"}
                              >
                                <Icons.ChevronsUpDown className="h-2.5 w-2.5 text-rose-400" />
                                <span>{isAllSeveritiesCollapsed ? 'Expand All' : 'Collapse All'}</span>
                              </button>
                            )}
                          </div>

                          {/* Show Meta Toggle */}
                          <label className="flex items-center space-x-1.5 text-[8px] font-mono font-bold cursor-pointer text-slate-400 hover:text-slate-200 bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
                            <input
                              type="checkbox"
                              checked={showMeta}
                              onChange={(e) => setShowMeta(e.target.checked)}
                              className="rounded bg-slate-950 border-slate-700 text-indigo-500 focus:ring-0 h-3 w-3 cursor-pointer"
                            />
                            <span className="flex items-center space-x-1">
                              <Icons.Info className="h-2.5 w-2.5 text-indigo-400" />
                              <span>Show Meta</span>
                            </span>
                          </label>

                          {/* Include Archived Logs Toggle */}
                          <label className="flex items-center space-x-1.5 text-[8px] font-mono font-bold cursor-pointer text-slate-400 hover:text-slate-200 bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
                            <input
                              type="checkbox"
                              checked={includeArchivedLogs}
                              onChange={(e) => handleToggleArchived(e.target.checked)}
                              className="rounded bg-slate-950 border-slate-700 text-indigo-500 focus:ring-0 h-3 w-3 cursor-pointer"
                            />
                            <span className="flex items-center space-x-1">
                              <Icons.Archive className="h-2.5 w-2.5 text-purple-400" />
                              <span>Include Archived Logs</span>
                            </span>
                          </label>

                          {isFetchingArchived && (
                            <span className="text-[7.5px] text-purple-400 animate-pulse font-mono flex items-center space-x-1">
                              <Icons.Loader2 className="h-2.5 w-2.5 animate-spin" />
                              <span>Fetching Archive...</span>
                            </span>
                          )}

                          {/* Export CSV Button */}
                          <button
                            type="button"
                            onClick={handleExportSearchCSV}
                            className="px-2 py-1 rounded-md text-[8px] font-mono font-bold bg-indigo-950 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/60 hover:border-indigo-500 flex items-center space-x-1 cursor-pointer transition-all"
                            title="Export visible search results to CSV"
                          >
                            <Icons.Download className="h-2.5 w-2.5 text-indigo-400" />
                            <span>Export CSV</span>
                          </button>
                        </div>
                      </div>

                      {/* CATEGORY FILTER TAB TOGGLES */}
                      <div className="flex items-center space-x-1 border-b border-slate-900/80 pb-2 mb-2.5 overflow-x-auto">
                        {(['All', 'Incidents', 'Runbooks', 'Audit'] as const).map(cat => {
                          const count = cat === 'All'
                            ? (searchResults.incidents.length + searchResults.runbooks.length + searchResults.audits.length + (includeArchivedLogs ? archivedIncidents.length + archivedAudits.length : 0))
                            : cat === 'Incidents' ? searchResults.incidents.length + (includeArchivedLogs ? archivedIncidents.length : 0)
                            : cat === 'Runbooks' ? searchResults.runbooks.length
                            : searchResults.audits.length + (includeArchivedLogs ? archivedAudits.length : 0);
                          
                          const isActive = searchCategoryFilter === cat;

                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setSearchCategoryFilter(cat)}
                              className={`px-2 py-1 rounded-md text-[8.5px] font-mono font-bold transition-all cursor-pointer flex items-center space-x-1 whitespace-nowrap ${
                                isActive
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                              }`}
                            >
                              <span>{cat}</span>
                              <span className={`px-1 py-0.2 rounded-full text-[7.5px] ${isActive ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-950 text-slate-500'}`}>
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* SAVED SEARCHES BOOKMARKS CHIPS */}
                      {savedSearches.length > 0 && (
                        <div className="mb-2.5 p-2 rounded-lg bg-amber-950/20 border border-amber-900/40">
                          <div className="flex items-center justify-between text-[8px] font-mono text-amber-400 mb-1">
                            <span className="flex items-center space-x-1 uppercase tracking-wider font-bold">
                              <Icons.Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                              <span>Saved Search Bookmarks</span>
                            </span>
                            <span className="text-[7.5px] text-amber-500/70">{savedSearches.length} saved</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {savedSearches.map(item => (
                              <span
                                key={item.id}
                                onClick={() => {
                                  setSearchQuery(item.query);
                                  setSearchCategoryFilter(item.category);
                                  trackQuery(item.query);
                                  setShowSearchPreview(true);
                                }}
                                className="group flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-950 hover:bg-amber-950/80 border border-amber-800/40 hover:border-amber-500/60 text-amber-200 text-[8.5px] font-mono cursor-pointer transition-all"
                              >
                                <span>{item.query}</span>
                                {item.category !== 'All' && (
                                  <span className="px-1 py-0.2 text-[7px] bg-amber-900/60 text-amber-300 rounded uppercase">{item.category}</span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => removeSavedSearch(item.id, e)}
                                  className="text-amber-500 hover:text-rose-400 rounded-full p-0.5"
                                  title="Delete saved search bookmark"
                                >
                                  <Icons.X className="h-2.5 w-2.5" />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* RECENT SEARCHES CHIPS */}
                      {recentSearches.length > 0 && (
                        <div className="mb-3 p-2 rounded-lg bg-slate-900/50 border border-slate-900">
                          <div className="flex items-center justify-between text-[8px] font-mono text-slate-400 mb-1.5">
                            <span className="flex items-center space-x-1 uppercase tracking-wider font-bold text-slate-400">
                              <Icons.History className="h-2.5 w-2.5 text-slate-400" />
                              <span>Recent Searches</span>
                            </span>
                            <button
                              type="button"
                              onClick={clearRecentSearches}
                              className="text-[7.5px] text-slate-500 hover:text-rose-400 transition-colors"
                            >
                              Clear
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {recentSearches.map(q => (
                              <span
                                key={q}
                                onClick={() => {
                                  setSearchQuery(q);
                                  trackQuery(q);
                                  setShowSearchPreview(true);
                                }}
                                className="group flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-950 hover:bg-indigo-950 border border-slate-800/80 hover:border-indigo-500/40 text-slate-300 hover:text-indigo-200 text-[8.5px] font-mono cursor-pointer transition-all"
                              >
                                <span>{q}</span>
                                <button
                                  type="button"
                                  onClick={(e) => removeRecentSearch(q, e)}
                                  className="text-slate-500 hover:text-rose-400 rounded-full p-0.5"
                                  title="Remove recent search"
                                >
                                  <Icons.X className="h-2.5 w-2.5" />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* GRID WITH PREVIEW SIDEBAR */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        {/* SEARCH RESULTS LIST (Left 7 Cols) */}
                        <div className="md:col-span-7">
                          {flatSearchResults.length === 0 ? (
                            <div className="py-6 text-center text-slate-500 italic">
                              {searchQuery.trim() ? (
                                <span>No indexed records matching "{searchQuery}" {searchCategoryFilter !== 'All' ? `in ${searchCategoryFilter}` : ''}</span>
                              ) : (
                                <span>Type to search across active tickets, runbooks, and audit logs...</span>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-3 select-none">
                              {/* INCIDENTS CATEGORY */}
                              {filteredIncidents.length > 0 && (
                                <div>
                                  <div className="text-[8px] font-bold text-rose-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                                    <span className="flex items-center space-x-1">
                                      <Icons.ShieldAlert className="h-3 w-3" />
                                      <span>Incident Tickets ({filteredIncidents.length})</span>
                                    </span>

                                    {/* Select All Checkbox & Clear All for Incident Results */}
                                    <div className="flex items-center space-x-1.5">
                                      <label className="flex items-center space-x-1 text-[8px] font-mono text-slate-400 hover:text-rose-300 cursor-pointer bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800">
                                        <input
                                          type="checkbox"
                                          checked={isAllIncidentsSelected}
                                          onChange={toggleSelectAllIncidents}
                                          className="rounded bg-slate-950 border-slate-700 text-rose-500 focus:ring-0 h-2.5 w-2.5 cursor-pointer"
                                        />
                                        <span>Select All</span>
                                      </label>

                                      {selectedIncidentIds.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => setSelectedIncidentIds([])}
                                          className="text-[8px] font-mono font-bold text-rose-400 hover:text-rose-200 bg-rose-950/60 hover:bg-rose-900/80 px-1.5 py-0.5 rounded border border-rose-800/80 cursor-pointer transition-colors"
                                          title="Reset selection to empty array"
                                        >
                                          Clear All
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* BULK ACTIONS BAR (When 1+ incidents selected) */}
                                  {selectedIncidentIds.length > 0 && (
                                    <div className="mb-2 p-1.5 px-2 rounded-lg bg-rose-950/80 border border-rose-800/80 flex items-center justify-between text-[8px] font-mono text-rose-200">
                                      <div className="flex items-center space-x-1.5 font-bold">
                                        <span className="bg-rose-500 text-white px-1.5 py-0.2 rounded font-black text-[7.5px]">
                                          {selectedIncidentIds.length} Selected
                                        </span>
                                        <span className="hidden sm:inline">Bulk Operations</span>
                                      </div>

                                      <div className="flex items-center space-x-1">
                                        <button
                                          type="button"
                                          onClick={handleBulkAssignIncidents}
                                          className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors cursor-pointer flex items-center space-x-1"
                                          title="Assign selected incidents to Senior On-Call Engineer"
                                        >
                                          <Icons.UserCheck className="h-2.5 w-2.5" />
                                          <span>Bulk Assign</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={handleBulkArchiveIncidents}
                                          className="px-2 py-0.5 rounded bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-700/60 font-bold transition-colors cursor-pointer flex items-center space-x-1"
                                          title="Archive selected incidents to Cold Vault"
                                        >
                                          <Icons.Archive className="h-2.5 w-2.5" />
                                          <span>Bulk Archive</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => setSelectedIncidentIds([])}
                                          className="text-slate-400 hover:text-slate-200 px-1"
                                          title="Clear Selection"
                                        >
                                          <Icons.X className="h-2.5 w-2.5" />
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  <div className="space-y-1">
                                    {groupBySeverity ? (
                                      (['SEV-1', 'SEV-2', 'SEV-3', 'SEV-4'] as const).map(sevGroup => {
                                        const sevItems = filteredIncidents.filter(i => i.severity === sevGroup);
                                        if (sevItems.length === 0) return null;
                                        const isGroupCollapsed = collapsedSeverities[sevGroup];

                                        return (
                                          <div key={sevGroup} className="mb-2">
                                            <button
                                              type="button"
                                              onClick={() => toggleSeverityGroup(sevGroup)}
                                              className="w-full flex items-center justify-between p-1 px-2 mb-1 rounded bg-rose-950/40 hover:bg-rose-900/40 border border-rose-900/50 text-[8px] font-mono font-bold text-rose-300 cursor-pointer transition-colors"
                                            >
                                              <span className="flex items-center space-x-1.5">
                                                {isGroupCollapsed ? <Icons.ChevronRight className="h-2.5 w-2.5 text-rose-400" /> : <Icons.ChevronDown className="h-2.5 w-2.5 text-rose-400" />}
                                                <span>{sevGroup} ({sevItems.length})</span>
                                              </span>
                                              <span className="text-[7.5px] text-rose-400/80">{isGroupCollapsed ? 'Expand' : 'Collapse'}</span>
                                            </button>

                                            {!isGroupCollapsed && (
                                              <div className="space-y-1 pl-1">
                                                {sevItems.map(inc => {
                                                  const itemId = `inc-${inc.id}`;
                                                  const itemIndex = flatSearchResults.findIndex(f => f.id === itemId);
                                                  const isFocused = itemIndex === focusedSearchIndex;
                                                  const shortcutDigit = itemIndex < 9 ? itemIndex + 1 : null;
                                                  const isArch = (inc as any).isArchived;
                                                  const isSelected = selectedIncidentIds.includes(inc.id);
                                                  const isRead = readItemIds.includes(itemId);
                                                  const statusBadge = getStatusBadge({ id: inc.id, type: 'incident', severity: inc.severity, isArchived: isArch });
                                                  const meta = getTechnicalMeta(inc.id, 'incident');

                                                  return (
                                                    <div key={inc.id} className="relative flex items-center space-x-1.5">
                                                      <motion.div
                                                        whileTap={{ scale: 0.8 }}
                                                        whileHover={{ scale: 1.15 }}
                                                        animate={{ scale: isSelected ? [1, 1.25, 1] : 1 }}
                                                        transition={{ duration: 0.15 }}
                                                      >
                                                        <input
                                                          type="checkbox"
                                                          checked={isSelected}
                                                          onChange={(e) => toggleSelectIncident(inc.id, e as any)}
                                                          onClick={(e) => e.stopPropagation()}
                                                          className="rounded bg-slate-950 border-slate-700 text-rose-500 focus:ring-0 h-3 w-3 cursor-pointer shrink-0 ml-0.5"
                                                          title="Select incident"
                                                        />
                                                      </motion.div>

                                                      <button
                                                        onClick={() => {
                                                          setActiveTab('workspace');
                                                          setShowSearchPreview(false);
                                                          setToastMessage(`Focused workspace context on: ${inc.id}`);
                                                          addRecentSearch(inc.title || searchQuery);
                                                          trackClick();
                                                        }}
                                                        onMouseEnter={() => {
                                                          setFocusedSearchIndex(itemIndex);
                                                          setHoveredPreviewItem({
                                                            id: inc.id,
                                                            type: 'incident',
                                                            title: inc.title,
                                                            subtitle: inc.description,
                                                            badge: inc.severity,
                                                            isArchived: isArch,
                                                            onClick: () => {
                                                              setActiveTab('workspace');
                                                              setShowSearchPreview(false);
                                                              setToastMessage(`Focused workspace context on: ${inc.id}`);
                                                            }
                                                          });
                                                        }}
                                                        className={`flex-1 text-left p-2 rounded-lg border transition-all block group cursor-pointer ${
                                                          isRead ? 'opacity-50 hover:opacity-100 ' : ''
                                                        }${
                                                          isSelected
                                                            ? 'bg-rose-950/40 border-rose-600/80 ring-1 ring-rose-500/40'
                                                            : isFocused
                                                            ? 'bg-rose-500/20 border-rose-500 ring-1 ring-rose-500/50 text-white shadow-md'
                                                            : 'bg-slate-900/40 hover:bg-rose-500/10 border-slate-900 hover:border-rose-500/20'
                                                        }`}
                                                      >
                                                        <div className="flex items-center justify-between font-bold mb-0.5">
                                                          <div className="flex items-center space-x-1.5 truncate pr-1">
                                                            {shortcutDigit && (
                                                              <span className="px-1 py-0.2 rounded bg-slate-950 border border-slate-800 text-amber-300 font-mono text-[7.5px] font-bold">
                                                                [{shortcutDigit}]
                                                              </span>
                                                            )}
                                                            <span className={`font-sans truncate ${isFocused ? 'text-rose-300 font-extrabold' : 'text-slate-200 group-hover:text-rose-400'}`}>
                                                              <HighlightMatch text={inc.title} query={searchQuery} />
                                                            </span>
                                                          </div>
                                                          <div className="flex items-center space-x-1 shrink-0">
                                                            <span className={`text-[7.5px] font-mono font-bold px-1.5 py-0.2 rounded border ${statusBadge.color}`}>
                                                              {statusBadge.label}
                                                            </span>
                                                            <span className="text-[8px] text-rose-500 bg-rose-500/10 px-1.5 rounded">{inc.severity}</span>
                                                            <button
                                                              type="button"
                                                              onClick={(e) => toggleReadItem(itemId, e)}
                                                              className={`p-0.5 rounded transition-colors ${isRead ? 'text-indigo-400 bg-indigo-950/60' : 'text-slate-500 hover:text-indigo-300 hover:bg-slate-800/80'}`}
                                                              title={isRead ? "Mark as unread" : "Mark as read"}
                                                            >
                                                              {isRead ? <Icons.EyeOff className="h-2.5 w-2.5" /> : <Icons.Eye className="h-2.5 w-2.5" />}
                                                            </button>
                                                            <button
                                                              type="button"
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingNoteItemId(editingNoteItemId === itemId ? null : itemId);
                                                              }}
                                                              className={`p-0.5 rounded transition-colors ${itemNotes[itemId] ? 'text-amber-400 bg-amber-950/60' : 'text-slate-500 hover:text-amber-300 hover:bg-slate-800/80'}`}
                                                              title={itemNotes[itemId] ? "Edit Note" : "Add Note"}
                                                            >
                                                              <Icons.FileText className="h-2.5 w-2.5" />
                                                            </button>
                                                            <button
                                                              type="button"
                                                              onClick={(e) => handleCopyResultLink({ id: inc.id, title: inc.title, type: 'incident' }, e)}
                                                              className="p-0.5 text-slate-500 hover:text-indigo-300 hover:bg-slate-800/80 rounded transition-colors"
                                                              title="Copy deep link"
                                                            >
                                                              <Icons.Copy className="h-2.5 w-2.5" />
                                                            </button>
                                                            <button
                                                              type="button"
                                                              onClick={(e) => handleShareResultLink({ id: inc.id, title: inc.title, type: 'incident' }, e)}
                                                              className="p-0.5 text-slate-500 hover:text-emerald-300 hover:bg-slate-800/80 rounded transition-colors"
                                                              title="Share deep link"
                                                            >
                                                              <Icons.Share2 className="h-2.5 w-2.5" />
                                                            </button>
                                                          </div>
                                                        </div>
                                                        <p className="text-[9.5px] text-slate-400 line-clamp-1 leading-snug">
                                                          <HighlightMatch text={inc.description} query={searchQuery} />
                                                        </p>

                                                        {editingNoteItemId === itemId && (
                                                          <div className="mt-1.5 pt-1 border-t border-slate-800/80 flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                                                            <Icons.FileText className="h-2.5 w-2.5 text-amber-400 shrink-0" />
                                                            <input
                                                              type="text"
                                                              value={itemNotes[itemId] || ''}
                                                              onChange={(e) => setItemNotes(prev => ({ ...prev, [itemId]: e.target.value }))}
                                                              onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                  setEditingNoteItemId(null);
                                                                  if (itemNotes[itemId]) setToastMessage(`Saved note for ${inc.id}`);
                                                                }
                                                              }}
                                                              placeholder="Add a quick note..."
                                                              className="flex-1 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[8px] text-amber-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 font-mono"
                                                              autoFocus
                                                            />
                                                            <button
                                                              type="button"
                                                              onClick={() => {
                                                                setEditingNoteItemId(null);
                                                                if (itemNotes[itemId]) setToastMessage(`Saved note for ${inc.id}`);
                                                              }}
                                                              className="px-1.5 py-0.5 text-[7.5px] bg-amber-900/60 hover:bg-amber-800 text-amber-200 rounded font-mono font-bold"
                                                            >
                                                              Save
                                                            </button>
                                                          </div>
                                                        )}

                                                        {itemNotes[itemId] && editingNoteItemId !== itemId && (
                                                          <div className="mt-1 pt-0.5 flex items-center space-x-1 text-[8px] font-mono text-amber-300 bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-900/40">
                                                            <Icons.FileText className="h-2 w-2 text-amber-400 shrink-0" />
                                                            <span className="truncate">Note: {itemNotes[itemId]}</span>
                                                          </div>
                                                        )}

                                                        {showMeta && (
                                                          <div className="mt-1.5 pt-1 border-t border-slate-800/60 flex items-center justify-between text-[7.5px] font-mono text-slate-400">
                                                            <span>Src: {meta.source}</span>
                                                            <span>Updated: {meta.lastUpdated}</span>
                                                            <span className="text-emerald-400 font-bold">Conf: {meta.confidence}</span>
                                                          </div>
                                                        )}
                                                      </button>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })
                                    ) : (
                                      filteredIncidents.map(inc => {
                                        const itemId = `inc-${inc.id}`;
                                        const itemIndex = flatSearchResults.findIndex(f => f.id === itemId);
                                        const isFocused = itemIndex === focusedSearchIndex;
                                        const shortcutDigit = itemIndex < 9 ? itemIndex + 1 : null;
                                        const isArch = (inc as any).isArchived;
                                        const isSelected = selectedIncidentIds.includes(inc.id);
                                        const isRead = readItemIds.includes(itemId);
                                        const statusBadge = getStatusBadge({ id: inc.id, type: 'incident', severity: inc.severity, isArchived: isArch });
                                        const meta = getTechnicalMeta(inc.id, 'incident');

                                        return (
                                          <div key={inc.id} className="relative flex items-center space-x-1.5">
                                            {/* Checkbox for individual selection with motion scale */}
                                            <motion.div
                                              whileTap={{ scale: 0.8 }}
                                              whileHover={{ scale: 1.15 }}
                                              animate={{ scale: isSelected ? [1, 1.25, 1] : 1 }}
                                              transition={{ duration: 0.15 }}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={(e) => toggleSelectIncident(inc.id, e as any)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="rounded bg-slate-950 border-slate-700 text-rose-500 focus:ring-0 h-3 w-3 cursor-pointer shrink-0 ml-0.5"
                                                title="Select incident"
                                              />
                                            </motion.div>

                                            <button
                                              onClick={() => {
                                                setActiveTab('workspace');
                                                setShowSearchPreview(false);
                                                setToastMessage(`Focused workspace context on: ${inc.id}`);
                                                addRecentSearch(inc.title || searchQuery);
                                                trackClick();
                                              }}
                                              onMouseEnter={() => {
                                                setFocusedSearchIndex(itemIndex);
                                                setHoveredPreviewItem({
                                                  id: inc.id,
                                                  type: 'incident',
                                                  title: inc.title,
                                                  subtitle: inc.description,
                                                  badge: inc.severity,
                                                  isArchived: isArch,
                                                  onClick: () => {
                                                    setActiveTab('workspace');
                                                    setShowSearchPreview(false);
                                                    setToastMessage(`Focused workspace context on: ${inc.id}`);
                                                  }
                                                });
                                              }}
                                              className={`flex-1 text-left p-2 rounded-lg border transition-all block group cursor-pointer ${
                                                isRead ? 'opacity-50 hover:opacity-100 ' : ''
                                              }${
                                                isSelected
                                                  ? 'bg-rose-950/40 border-rose-600/80 ring-1 ring-rose-500/40'
                                                  : isFocused
                                                  ? 'bg-rose-500/20 border-rose-500 ring-1 ring-rose-500/50 text-white shadow-md'
                                                  : 'bg-slate-900/40 hover:bg-rose-500/10 border-slate-900 hover:border-rose-500/20'
                                              }`}
                                            >
                                              <div className="flex items-center justify-between font-bold mb-0.5">
                                                <div className="flex items-center space-x-1.5 truncate pr-1">
                                                  {shortcutDigit && (
                                                    <span className="px-1 py-0.2 rounded bg-slate-950 border border-slate-800 text-amber-300 font-mono text-[7.5px] font-bold">
                                                      [{shortcutDigit}]
                                                    </span>
                                                  )}
                                                  <span className={`font-sans truncate ${isFocused ? 'text-rose-300 font-extrabold' : 'text-slate-200 group-hover:text-rose-400'}`}>
                                                    <HighlightMatch text={inc.title} query={searchQuery} />
                                                  </span>
                                                </div>
                                                <div className="flex items-center space-x-1 shrink-0">
                                                  <span className={`text-[7.5px] font-mono font-bold px-1.5 py-0.2 rounded border ${statusBadge.color}`}>
                                                    {statusBadge.label}
                                                  </span>
                                                  <span className="text-[8px] text-rose-500 bg-rose-500/10 px-1.5 rounded">{inc.severity}</span>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => toggleReadItem(itemId, e)}
                                                    className={`p-0.5 rounded transition-colors ${isRead ? 'text-indigo-400 bg-indigo-950/60' : 'text-slate-500 hover:text-indigo-300 hover:bg-slate-800/80'}`}
                                                    title={isRead ? "Mark as unread" : "Mark as read"}
                                                  >
                                                    {isRead ? <Icons.EyeOff className="h-2.5 w-2.5" /> : <Icons.Eye className="h-2.5 w-2.5" />}
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setEditingNoteItemId(editingNoteItemId === itemId ? null : itemId);
                                                    }}
                                                    className={`p-0.5 rounded transition-colors ${itemNotes[itemId] ? 'text-amber-400 bg-amber-950/60' : 'text-slate-500 hover:text-amber-300 hover:bg-slate-800/80'}`}
                                                    title={itemNotes[itemId] ? "Edit Note" : "Add Note"}
                                                  >
                                                    <Icons.FileText className="h-2.5 w-2.5" />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => handleCopyResultLink({ id: inc.id, title: inc.title, type: 'incident' }, e)}
                                                    className="p-0.5 text-slate-500 hover:text-indigo-300 hover:bg-slate-800/80 rounded transition-colors"
                                                    title="Copy deep link"
                                                  >
                                                    <Icons.Copy className="h-2.5 w-2.5" />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => handleShareResultLink({ id: inc.id, title: inc.title, type: 'incident' }, e)}
                                                    className="p-0.5 text-slate-500 hover:text-emerald-300 hover:bg-slate-800/80 rounded transition-colors"
                                                    title="Share deep link"
                                                  >
                                                    <Icons.Share2 className="h-2.5 w-2.5" />
                                                  </button>
                                                </div>
                                              </div>
                                              <p className="text-[9.5px] text-slate-400 line-clamp-1 leading-snug">
                                                <HighlightMatch text={inc.description} query={searchQuery} />
                                              </p>

                                              {editingNoteItemId === itemId && (
                                                <div className="mt-1.5 pt-1 border-t border-slate-800/80 flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                                                  <Icons.FileText className="h-2.5 w-2.5 text-amber-400 shrink-0" />
                                                  <input
                                                    type="text"
                                                    value={itemNotes[itemId] || ''}
                                                    onChange={(e) => setItemNotes(prev => ({ ...prev, [itemId]: e.target.value }))}
                                                    onKeyDown={(e) => {
                                                      if (e.key === 'Enter') {
                                                        setEditingNoteItemId(null);
                                                        if (itemNotes[itemId]) setToastMessage(`Saved note for ${inc.id}`);
                                                      }
                                                    }}
                                                    placeholder="Add a quick note..."
                                                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[8px] text-amber-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 font-mono"
                                                    autoFocus
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setEditingNoteItemId(null);
                                                      if (itemNotes[itemId]) setToastMessage(`Saved note for ${inc.id}`);
                                                    }}
                                                    className="px-1.5 py-0.5 text-[7.5px] bg-amber-900/60 hover:bg-amber-800 text-amber-200 rounded font-mono font-bold"
                                                  >
                                                    Save
                                                  </button>
                                                </div>
                                              )}

                                              {itemNotes[itemId] && editingNoteItemId !== itemId && (
                                                <div className="mt-1 pt-0.5 flex items-center space-x-1 text-[8px] font-mono text-amber-300 bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-900/40">
                                                  <Icons.FileText className="h-2 w-2 text-amber-400 shrink-0" />
                                                  <span className="truncate">Note: {itemNotes[itemId]}</span>
                                                </div>
                                              )}

                                              {showMeta && (
                                                <div className="mt-1.5 pt-1 border-t border-slate-800/60 flex items-center justify-between text-[7.5px] font-mono text-slate-400">
                                                  <span>Src: {meta.source}</span>
                                                  <span>Updated: {meta.lastUpdated}</span>
                                                  <span className="text-emerald-400 font-bold">Conf: {meta.confidence}</span>
                                                </div>
                                              )}
                                            </button>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* RUNBOOKS CATEGORY */}
                              {filteredRunbooks.length > 0 && (
                                <div>
                                  <div className="text-[8px] font-bold text-indigo-400 uppercase tracking-wider mb-1 flex items-center space-x-1">
                                    <Icons.BookOpen className="h-3 w-3" />
                                    <span>Knowledge Runbooks ({filteredRunbooks.length})</span>
                                  </div>
                                  <div className="space-y-1">
                                    {filteredRunbooks.map(kb => {
                                      const itemId = `kb-${kb.id}`;
                                      const itemIndex = flatSearchResults.findIndex(f => f.id === itemId);
                                      const isFocused = itemIndex === focusedSearchIndex;
                                      const shortcutDigit = itemIndex < 9 ? itemIndex + 1 : null;
                                      const isRead = readItemIds.includes(itemId);
                                      const statusBadge = getStatusBadge({ id: kb.id, type: 'runbook' });
                                      const meta = getTechnicalMeta(kb.id, 'runbook');

                                      return (
                                        <button
                                          key={kb.id}
                                          onClick={() => {
                                            setSelectedSearchRunbook(kb);
                                            setShowSearchPreview(false);
                                            addRecentSearch(kb.title || searchQuery);
                                            trackClick();
                                          }}
                                          onMouseEnter={() => {
                                            setFocusedSearchIndex(itemIndex);
                                            setHoveredPreviewItem({
                                              id: kb.id,
                                              type: 'runbook',
                                              title: kb.title,
                                              subtitle: kb.tags ? `Tags: ${kb.tags.join(', ')}` : kb.id,
                                              badge: kb.id,
                                              onClick: () => {
                                                setSelectedSearchRunbook(kb);
                                                setShowSearchPreview(false);
                                              }
                                            });
                                          }}
                                          className={`w-full text-left p-2 rounded-lg border transition-all block group cursor-pointer ${
                                            isRead ? 'opacity-50 hover:opacity-100 ' : ''
                                          }${
                                            isFocused
                                              ? 'bg-indigo-500/20 border-indigo-500 ring-1 ring-indigo-500/50 text-white shadow-md'
                                              : 'bg-slate-900/40 hover:bg-indigo-500/10 border-slate-900 hover:border-indigo-500/20'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between font-bold mb-0.5">
                                            <div className="flex items-center space-x-1.5 truncate pr-1">
                                              {shortcutDigit && (
                                                <span className="px-1 py-0.2 rounded bg-slate-950 border border-slate-800 text-amber-300 font-mono text-[7.5px] font-bold">
                                                  [{shortcutDigit}]
                                                </span>
                                              )}
                                              <span className={`font-sans truncate ${isFocused ? 'text-indigo-300 font-extrabold' : 'text-slate-200 group-hover:text-indigo-400'}`}>
                                                <HighlightMatch text={kb.title} query={searchQuery} />
                                              </span>
                                            </div>
                                            <div className="flex items-center space-x-1 shrink-0">
                                              <span className={`text-[7.5px] font-mono font-bold px-1.5 py-0.2 rounded border ${statusBadge.color}`}>
                                                {statusBadge.label}
                                              </span>
                                              <span className="text-[8px] text-slate-400 font-normal">{kb.id}</span>
                                              <button
                                                type="button"
                                                onClick={(e) => toggleReadItem(itemId, e)}
                                                className={`p-0.5 rounded transition-colors ${isRead ? 'text-indigo-400 bg-indigo-950/60' : 'text-slate-500 hover:text-indigo-300 hover:bg-slate-800/80'}`}
                                                title={isRead ? "Mark as unread" : "Mark as read"}
                                              >
                                                {isRead ? <Icons.EyeOff className="h-2.5 w-2.5" /> : <Icons.Eye className="h-2.5 w-2.5" />}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setEditingNoteItemId(editingNoteItemId === itemId ? null : itemId);
                                                }}
                                                className={`p-0.5 rounded transition-colors ${itemNotes[itemId] ? 'text-amber-400 bg-amber-950/60' : 'text-slate-500 hover:text-amber-300 hover:bg-slate-800/80'}`}
                                                title={itemNotes[itemId] ? "Edit Note" : "Add Note"}
                                              >
                                                <Icons.FileText className="h-2.5 w-2.5" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(e) => handleCopyResultLink({ id: kb.id, title: kb.title, type: 'runbook' }, e)}
                                                className="p-0.5 text-slate-500 hover:text-indigo-300 hover:bg-slate-800/80 rounded transition-colors"
                                                title="Copy deep link"
                                              >
                                                <Icons.Copy className="h-2.5 w-2.5" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(e) => handleShareResultLink({ id: kb.id, title: kb.title, type: 'runbook' }, e)}
                                                className="p-0.5 text-slate-500 hover:text-emerald-300 hover:bg-slate-800/80 rounded transition-colors"
                                                title="Share deep link"
                                              >
                                                <Icons.Share2 className="h-2.5 w-2.5" />
                                              </button>
                                            </div>
                                          </div>
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {kb.tags && kb.tags.map((t: string) => (
                                              <span key={t} className="text-[7.5px] bg-slate-950 text-slate-400 px-1 rounded">
                                                <HighlightMatch text={t} query={searchQuery} />
                                              </span>
                                            ))}
                                          </div>

                                          {editingNoteItemId === itemId && (
                                            <div className="mt-1.5 pt-1 border-t border-slate-800/80 flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                                              <Icons.FileText className="h-2.5 w-2.5 text-amber-400 shrink-0" />
                                              <input
                                                type="text"
                                                value={itemNotes[itemId] || ''}
                                                onChange={(e) => setItemNotes(prev => ({ ...prev, [itemId]: e.target.value }))}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    setEditingNoteItemId(null);
                                                    if (itemNotes[itemId]) setToastMessage(`Saved note for ${kb.id}`);
                                                  }
                                                }}
                                                placeholder="Add a quick note..."
                                                className="flex-1 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[8px] text-amber-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 font-mono"
                                                autoFocus
                                              />
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setEditingNoteItemId(null);
                                                  if (itemNotes[itemId]) setToastMessage(`Saved note for ${kb.id}`);
                                                }}
                                                className="px-1.5 py-0.5 text-[7.5px] bg-amber-900/60 hover:bg-amber-800 text-amber-200 rounded font-mono font-bold"
                                              >
                                                Save
                                              </button>
                                            </div>
                                          )}

                                          {itemNotes[itemId] && editingNoteItemId !== itemId && (
                                            <div className="mt-1 pt-0.5 flex items-center space-x-1 text-[8px] font-mono text-amber-300 bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-900/40">
                                              <Icons.FileText className="h-2 w-2 text-amber-400 shrink-0" />
                                              <span className="truncate">Note: {itemNotes[itemId]}</span>
                                            </div>
                                          )}

                                          {showMeta && (
                                            <div className="mt-1.5 pt-1 border-t border-slate-800/60 flex items-center justify-between text-[7.5px] font-mono text-slate-400">
                                              <span>Src: {meta.source}</span>
                                              <span>Updated: {meta.lastUpdated}</span>
                                              <span className="text-emerald-400 font-bold">Conf: {meta.confidence}</span>
                                            </div>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* AUDIT LOGS CATEGORY */}
                              {filteredAudits.length > 0 && (
                                <div>
                                  <div className="text-[8px] font-bold text-emerald-400 uppercase tracking-wider mb-1 flex items-center space-x-1">
                                    <Icons.Shield className="h-3 w-3" />
                                    <span>Immutable Audit Logs ({filteredAudits.length})</span>
                                  </div>
                                  <div className="space-y-1">
                                    {filteredAudits.map(aud => {
                                      const itemId = `aud-${aud.id}`;
                                      const itemIndex = flatSearchResults.findIndex(f => f.id === itemId);
                                      const isFocused = itemIndex === focusedSearchIndex;
                                      const shortcutDigit = itemIndex < 9 ? itemIndex + 1 : null;
                                      const isArch = (aud as any).isArchived;
                                      const isRead = readItemIds.includes(itemId);
                                      const statusBadge = getStatusBadge({ id: aud.id, type: 'audit', isArchived: isArch });
                                      const meta = getTechnicalMeta(aud.id, 'audit');

                                      return (
                                        <button
                                          key={aud.id}
                                          onClick={() => {
                                            setActiveTab('audit');
                                            setShowSearchPreview(false);
                                            setToastMessage(`Navigated to Audit Panel for event: ${aud.id}`);
                                            addRecentSearch(aud.action || searchQuery);
                                            trackClick();
                                          }}
                                          onMouseEnter={() => {
                                            setFocusedSearchIndex(itemIndex);
                                            setHoveredPreviewItem({
                                              id: aud.id,
                                              type: 'audit',
                                              title: aud.action,
                                              subtitle: aud.payload,
                                              badge: aud.id,
                                              isArchived: isArch,
                                              onClick: () => {
                                                setActiveTab('audit');
                                                setShowSearchPreview(false);
                                              }
                                            });
                                          }}
                                          className={`w-full text-left p-2 rounded-lg border transition-all block group cursor-pointer ${
                                            isRead ? 'opacity-50 hover:opacity-100 ' : ''
                                          }${
                                            isFocused
                                              ? 'bg-emerald-500/20 border-emerald-500 ring-1 ring-emerald-500/50 text-white shadow-md'
                                              : 'bg-slate-900/40 hover:bg-emerald-500/10 border-slate-900 hover:border-emerald-500/20'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between font-bold mb-0.5">
                                            <div className="flex items-center space-x-1.5 truncate pr-1">
                                              {shortcutDigit && (
                                                <span className="px-1 py-0.2 rounded bg-slate-950 border border-slate-800 text-amber-300 font-mono text-[7.5px] font-bold">
                                                  [{shortcutDigit}]
                                                </span>
                                              )}
                                              <span className={`font-sans truncate ${isFocused ? 'text-emerald-300 font-extrabold' : 'text-slate-200 group-hover:text-emerald-400'}`}>
                                                <HighlightMatch text={aud.action} query={searchQuery} />
                                              </span>
                                            </div>
                                            <div className="flex items-center space-x-1 shrink-0">
                                              <span className={`text-[7.5px] font-mono font-bold px-1.5 py-0.2 rounded border ${statusBadge.color}`}>
                                                {statusBadge.label}
                                              </span>
                                              <span className="text-[8.5px] text-slate-400">{aud.id}</span>
                                              <button
                                                type="button"
                                                onClick={(e) => toggleReadItem(itemId, e)}
                                                className={`p-0.5 rounded transition-colors ${isRead ? 'text-indigo-400 bg-indigo-950/60' : 'text-slate-500 hover:text-indigo-300 hover:bg-slate-800/80'}`}
                                                title={isRead ? "Mark as unread" : "Mark as read"}
                                              >
                                                {isRead ? <Icons.EyeOff className="h-2.5 w-2.5" /> : <Icons.Eye className="h-2.5 w-2.5" />}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setEditingNoteItemId(editingNoteItemId === itemId ? null : itemId);
                                                }}
                                                className={`p-0.5 rounded transition-colors ${itemNotes[itemId] ? 'text-amber-400 bg-amber-950/60' : 'text-slate-500 hover:text-amber-300 hover:bg-slate-800/80'}`}
                                                title={itemNotes[itemId] ? "Edit Note" : "Add Note"}
                                              >
                                                <Icons.FileText className="h-2.5 w-2.5" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(e) => handleCopyResultLink({ id: aud.id, title: aud.action, type: 'audit' }, e)}
                                                className="p-0.5 text-slate-500 hover:text-indigo-300 hover:bg-slate-800/80 rounded transition-colors"
                                                title="Copy deep link"
                                              >
                                                <Icons.Copy className="h-2.5 w-2.5" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(e) => handleShareResultLink({ id: aud.id, title: aud.action, type: 'audit' }, e)}
                                                className="p-0.5 text-slate-500 hover:text-emerald-300 hover:bg-slate-800/80 rounded transition-colors"
                                                title="Share deep link"
                                              >
                                                <Icons.Share2 className="h-2.5 w-2.5" />
                                              </button>
                                            </div>
                                          </div>
                                          <p className="text-[9.5px] text-slate-400 line-clamp-1 leading-snug">
                                            <HighlightMatch text={aud.payload} query={searchQuery} />
                                          </p>

                                          {editingNoteItemId === itemId && (
                                            <div className="mt-1.5 pt-1 border-t border-slate-800/80 flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                                              <Icons.FileText className="h-2.5 w-2.5 text-amber-400 shrink-0" />
                                              <input
                                                type="text"
                                                value={itemNotes[itemId] || ''}
                                                onChange={(e) => setItemNotes(prev => ({ ...prev, [itemId]: e.target.value }))}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    setEditingNoteItemId(null);
                                                    if (itemNotes[itemId]) setToastMessage(`Saved note for ${aud.id}`);
                                                  }
                                                }}
                                                placeholder="Add a quick note..."
                                                className="flex-1 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[8px] text-amber-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 font-mono"
                                                autoFocus
                                              />
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setEditingNoteItemId(null);
                                                  if (itemNotes[itemId]) setToastMessage(`Saved note for ${aud.id}`);
                                                }}
                                                className="px-1.5 py-0.5 text-[7.5px] bg-amber-900/60 hover:bg-amber-800 text-amber-200 rounded font-mono font-bold"
                                              >
                                                Save
                                              </button>
                                            </div>
                                          )}

                                          {itemNotes[itemId] && editingNoteItemId !== itemId && (
                                            <div className="mt-1 pt-0.5 flex items-center space-x-1 text-[8px] font-mono text-amber-300 bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-900/40">
                                              <Icons.FileText className="h-2 w-2 text-amber-400 shrink-0" />
                                              <span className="truncate">Note: {itemNotes[itemId]}</span>
                                            </div>
                                          )}

                                          {showMeta && (
                                            <div className="mt-1.5 pt-1 border-t border-slate-800/60 flex items-center justify-between text-[7.5px] font-mono text-slate-400">
                                              <span>Src: {meta.source}</span>
                                              <span>Updated: {meta.lastUpdated}</span>
                                              <span className="text-emerald-400 font-bold">Conf: {meta.confidence}</span>
                                            </div>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* PREVIEW SIDEBAR DRAWER (Right 5 Cols) */}
                        <div className="hidden md:block md:col-span-5 border-l border-slate-900 pl-3">
                          {hoveredPreviewItem ? (
                            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5 sticky top-0 font-mono text-[9px] shadow-lg">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                <span className="text-[8px] font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-1">
                                  <Icons.Eye className="h-3 w-3 text-indigo-400" />
                                  <span>Preview Mode</span>
                                </span>
                                {hoveredPreviewItem.badge && (
                                  <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 font-bold border border-indigo-800/60 text-[8px]">
                                    {hoveredPreviewItem.badge}
                                  </span>
                                )}
                              </div>

                              <div>
                                <span className="text-[7.5px] uppercase font-bold text-slate-500 tracking-wider">
                                  Category: {hoveredPreviewItem.type}
                                </span>
                                <h4 className="font-bold text-slate-100 text-[11px] font-sans leading-tight mt-0.5">
                                  {hoveredPreviewItem.title}
                                </h4>
                                <p className="text-[8px] text-slate-500 font-mono mt-0.5">ID: {hoveredPreviewItem.id}</p>
                              </div>

                              <div>
                                <span className="text-[7.5px] uppercase font-bold text-slate-500 tracking-wider">Description / Body Snippet:</span>
                                <div className="mt-1 p-2 rounded bg-slate-950 border border-slate-900/80 text-slate-300 line-clamp-6 text-[9px] leading-relaxed whitespace-pre-wrap">
                                  {hoveredPreviewItem.subtitle}
                                </div>
                              </div>

                              {hoveredPreviewItem.isArchived && (
                                <div className="p-1.5 rounded bg-purple-950/40 border border-purple-800/40 text-purple-300 text-[8px] flex items-center space-x-1.5">
                                  <Icons.Archive className="h-3 w-3 text-purple-400 shrink-0" />
                                  <span>Historical Cold Vault Storage Record</span>
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={hoveredPreviewItem.onClick}
                                className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[9px] cursor-pointer transition-colors flex items-center justify-center space-x-1 mt-2 shadow-xs"
                              >
                                <span>Open Item Context</span>
                                <Icons.ArrowRight className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-900/80 text-center text-slate-500 italic text-[9px] flex flex-col items-center justify-center h-full min-h-[160px] space-y-1.5">
                              <Icons.MousePointer className="h-5 w-5 text-slate-600" />
                              <span>Hover over any result or use 1-9 / ↑↓ keys to preview record details</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* RELATED QUERIES (SIMULATED AI SUGGESTIONS) */}
                      {relatedQueries.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-900">
                          <div className="flex items-center space-x-1.5 mb-1.5">
                            <Icons.Sparkles className="h-3 w-3 text-amber-400" />
                            <span className="text-[8.5px] font-bold text-amber-300 uppercase tracking-wider">
                              AI Related Queries
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {relatedQueries.map((rq, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setSearchQuery(rq);
                                  setShowSearchPreview(true);
                                  addRecentSearch(rq);
                                  setToastMessage(`Switched query to AI suggestion: "${rq}"`);
                                }}
                                className="px-2 py-1 rounded-md bg-slate-900 hover:bg-amber-950/60 text-slate-300 hover:text-amber-200 border border-slate-800 hover:border-amber-700/60 text-[8.5px] font-mono cursor-pointer transition-all flex items-center space-x-1 group"
                              >
                                <Icons.Search className="h-2.5 w-2.5 text-slate-500 group-hover:text-amber-400" />
                                <span>{rq}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* SEARCH USAGE METRICS MINI-CARD AT BOTTOM */}
                      <div className="mt-3.5 pt-2.5 border-t border-slate-900 bg-slate-900/80 rounded-lg p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-[8px] font-mono text-slate-400">
                          <div className="flex items-center space-x-1.5 font-bold uppercase tracking-wider text-indigo-400">
                            <Icons.BarChart3 className="h-3 w-3 text-indigo-400" />
                            <span>Search Analytics</span>
                          </div>
                          <button
                            type="button"
                            onClick={resetMetrics}
                            className="text-[7.5px] text-slate-500 hover:text-slate-300 underline cursor-pointer"
                            title="Reset search metrics"
                          >
                            Reset
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
                          <div className="bg-slate-950 p-1.5 rounded border border-slate-800/80">
                            <div className="text-[7.5px] text-slate-500 uppercase font-bold">Query Vol</div>
                            <div className="text-xs font-bold text-slate-200">{searchMetrics.queryVolume}</div>
                          </div>

                          <div className="bg-slate-950 p-1.5 rounded border border-slate-800/80">
                            <div className="text-[7.5px] text-slate-500 uppercase font-bold">Clicks</div>
                            <div className="text-xs font-bold text-emerald-400">{searchMetrics.clickCount}</div>
                          </div>

                          <div className="bg-slate-950 p-1.5 rounded border border-slate-800/80">
                            <div className="text-[7.5px] text-slate-500 uppercase font-bold">CTR</div>
                            <div className="text-xs font-bold text-amber-400">{searchMetrics.ctr}%</div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* System Health Telemetry Dashboard */}
            <div className="hidden md:block">
              <SystemHealthPanel />
            </div>

            {/* Centralized real-time SignalR alerts bell */}
            <NotificationBell
              notifications={notifications}
              onMarkAllAsRead={handleMarkAllNotificationsRead}
              onMarkAsRead={handleMarkNotificationRead}
              onClearAll={handleClearAllNotifications}
            />

            {/* EMERGENCY SYSTEM FREEZE BUTTON */}
            <button
              onClick={() => setIsFreezeModalOpen(true)}
              className={`p-1.5 px-2.5 rounded-lg border transition-all cursor-pointer flex items-center space-x-1.5 text-[10px] font-bold ${
                isSystemFrozen
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-400 hover:bg-rose-500/25 animate-pulse'
                  : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:text-rose-400 hover:border-rose-500/20 hover:bg-rose-950/10'
              }`}
              title={isSystemFrozen ? "Emergency Freeze is Active. Click to Resume System" : "Trigger Global Emergency System Freeze"}
            >
              <Icons.Snowflake className={`h-3.5 w-3.5 ${isSystemFrozen ? 'text-rose-400 animate-spin' : 'text-slate-400 group-hover:text-rose-400'}`} style={{ animationDuration: isSystemFrozen ? '3s' : undefined }} />
              <span>{isSystemFrozen ? "SYSTEM FROZEN" : "FREEZE"}</span>
            </button>

            {/* Accessibility Shortcuts Modal Button */}
            <button
              onClick={() => setIsShortcutsOpen(true)}
              className="p-1.5 rounded-lg border border-slate-900 bg-slate-900/40 text-slate-400 hover:text-white hover:border-slate-800 hover:bg-slate-900/80 transition-all cursor-pointer"
              title="View Keyboard Shortcuts & Accessibility Details (?)"
            >
              <Icons.Keyboard className="h-3.5 w-3.5 text-indigo-400" />
            </button>

            {/* CMD+K omni trigger button */}
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="flex items-center space-x-2 rounded-lg border border-slate-900 bg-slate-900/60 px-3 py-1.5 text-xxs text-slate-400 hover:border-slate-800 hover:bg-slate-900/80 transition-all cursor-pointer"
            >
              <Icons.Command className="h-3 w-3 text-indigo-400" />
              <span className="hidden sm:inline">Search Command Console...</span>
              <span className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[9px] text-slate-400">Ctrl+K</span>
            </button>
          </div>
        </header>

        {/* MEMOIZED LIVE SYSTEM INCIDENT ALERTS TICKER BAR */}
        <AlertsTicker
          tickerAlerts={tickerAlerts}
          selectedTickerIds={selectedTickerIds}
          setSelectedTickerIds={setSelectedTickerIds}
          showBulkAlertPopover={showBulkAlertPopover}
          setShowBulkAlertPopover={setShowBulkAlertPopover}
          handleBulkAlertAction={handleBulkAlertAction}
        />

        {/* COMPONENT VIEWS PORT (With clean visual transitions & ErrorBoundary wrapping) */}
        <main className={`flex-1 overflow-hidden bg-slate-950 transition-all duration-300 ${uiDensity === 'compact' ? 'p-3.5' : 'p-8'}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="h-full w-full"
            >
              <ErrorBoundary>
                {activeTab === 'workspace' && (
                  <IncidentWorkspace 
                    modelSelection={modelSelection} 
                    onAddAuditLog={handleAddAuditLog} 
                  />
                )}

                {activeTab === 'agents' && (
                  <AgentOrchestrator 
                    modelSelection={modelSelection} 
                  />
                )}

                {activeTab === 'metrics' && (
                  <MetricsDashboard />
                )}

                {activeTab === 'runbooks' && (
                  <RunbookManager 
                    modelSelection={modelSelection} 
                    onAddAuditLog={handleAddAuditLog} 
                  />
                )}

                {activeTab === 'settings' && (
                  <SettingsConsole 
                    modelSelection={modelSelection} 
                    onSetModelSelection={setModelSelection} 
                    theme={theme}
                    onSetTheme={handleSetTheme}
                    searchSoundEnabled={searchSoundEnabled}
                    onSetSearchSoundEnabled={handleSetSearchSoundEnabled}
                  />
                )}

                {activeTab === 'audit' && (
                  <AuditPanel 
                    auditLogs={auditLogs} 
                  />
                )}

                {activeTab === 'aspnet' && (
                  <AspNetConsole />
                )}
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>

      </div>

      {/* GLOBAL TOAST NOTIFICATION POPUP */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-emerald-500/25 bg-slate-900/90 backdrop-blur-md p-4 shadow-2xl flex items-center space-x-3 max-w-sm border-l-4 border-l-emerald-500">
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400 shrink-0">
            <Icons.CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="text-xxs">
            <div className="font-bold text-white uppercase tracking-wider mb-0.5">Execution Success</div>
            <p className="text-slate-400 font-mono leading-snug">{toastMessage}</p>
          </div>
        </div>
      )}

      {/* SESSION EXPIRE PULSE WARNING (60s BEFORE LOCK) */}
      <AnimatePresence>
        {!isLocked && secondsRemaining <= 60 && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: '-50%', scale: 0.95 }}
            animate={{ opacity: [1, 0.7, 1], y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{
              opacity: {
                repeat: Infinity,
                duration: 2,
                ease: "easeInOut"
              },
              type: 'spring',
              stiffness: 350,
              damping: 25
            }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-rose-500/40 bg-slate-900/95 backdrop-blur-md p-4.5 shadow-2xl flex items-start space-x-4 max-w-md border-l-4 border-l-rose-500 ring-2 ring-rose-500/10 select-none"
          >
            <div className="rounded-lg bg-rose-500/20 p-2 text-rose-400 shrink-0 animate-pulse">
              <Icons.ShieldAlert className="h-5 w-5" />
            </div>
            <div className="text-left flex-1">
              <div className="font-bold text-white text-[11px] uppercase tracking-wider flex items-center justify-between">
                <span>Operational Inactivity Warning</span>
                <span className="font-mono text-rose-400 bg-rose-500/15 px-1.5 py-0.5 rounded text-[9.5px] font-black border border-rose-500/20 animate-pulse">
                  {secondsRemaining}s
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-1 leading-normal">
                Your session is about to be secured and locked. Extend now to prevent workflow interruption.
              </p>
              <div className="mt-3 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setSecondsRemaining(900);
                    setToastMessage("Active session extended for another 15 minutes.");
                    handleAddAuditLog(
                      "Eshan Barua (CTO)",
                      "Extend Session Handshake",
                      "Compliance Engine",
                      "SUCCESS",
                      "Extended secure operational session via visual timeout warning pulse handler."
                    );
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold font-mono text-[9px] uppercase cursor-pointer transition-all flex items-center space-x-1.5 shadow-lg shadow-rose-600/20"
                >
                  <Icons.Clock className="h-3.5 w-3.5" />
                  <span>Extend Session (15m)</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BACKGROUND SIGNALR CLIENT MANAGER */}
      <SignalRClientManager
        onAlert={handleSignalRAlert}
        onAddAuditLog={handleAddAuditLog}
      />

      {/* COMMAND PALETTE MODAL */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onExecuteCommand={handleExecuteCommandFromPalette}
        onNavigate={(tabId) => setActiveTab(tabId as any)}
      />

      {/* ACCESSIBILITY KEYBOARD SHORTCUTS MODAL */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
        activeTab={activeTab}
      />

      {/* SECURITY LOCK SCREEN OVERLAY */}
      <AnimatePresence>
        {isLocked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/98 backdrop-blur-2xl text-slate-100"
          >
            <motion.div
              initial={{ scale: 0.9, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: -15 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="w-full max-w-sm rounded-2xl border border-slate-900 bg-slate-950/80 p-8 text-center shadow-2xl shadow-indigo-950/20 relative overflow-hidden"
            >
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl animate-pulse" />

              <div className="relative mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400">
                <Icons.ShieldAlert className="h-7 w-7 animate-pulse" />
                <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                </span>
              </div>

              <h2 className="font-display font-black tracking-widest text-white text-xs uppercase">
                SUPPORTPILOT SECURE KERNEL
              </h2>
              <p className="text-[9px] font-mono text-slate-500 mt-1 uppercase tracking-wider">
                Operational Console Protection Shield
              </p>

              <div className="mt-6 rounded-xl bg-slate-900/40 border border-slate-900/60 p-4 flex items-center space-x-3.5 text-left">
                <div className="relative h-10 w-10 shrink-0 rounded-lg bg-indigo-600/20 border border-indigo-500/15 flex items-center justify-center">
                  <Icons.User className="h-5 w-5 text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white">{ActiveUser.name}</div>
                  <div className="text-[9px] font-mono text-indigo-400 uppercase tracking-wider">{ActiveUser.role}</div>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setIsLocked(false);
                  handleAddAuditLog(
                    "Eshan Barua (CTO)", 
                    "Authorize Resume", 
                    "Compliance Engine", 
                    "SUCCESS", 
                    "Unlocked secure session via operator authorization handshake."
                  );
                }}
                className="mt-6 space-y-3.5"
              >
                <div className="space-y-1 text-left">
                  <label className="text-[9px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                    Enter Operator Passcode
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="••••••••"
                      autoFocus
                      required
                      className="w-full rounded-lg border border-slate-900 bg-slate-950 px-3 py-2.5 text-center font-mono text-xs text-white placeholder-slate-700 outline-none focus:border-indigo-500/50 transition-all"
                    />
                    <Icons.Lock className="absolute right-3.5 top-3.5 h-3.5 w-3.5 text-slate-600" />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                  <Icons.Unlock className="h-3.5 w-3.5" />
                  <span>Verify and Resume</span>
                </button>
                
                <p className="text-[9px] text-slate-500 font-mono mt-2">
                  Protected session will auto-lock again after 15m of inactivity.
                </p>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EMERGENCY SYSTEM FREEZE CONFIRMATION MODAL */}
      <AnimatePresence>
        {isFreezeModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.93, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.93, y: -10 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center shadow-2xl relative overflow-hidden"
            >
              <div className={`absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl opacity-20 ${isSystemFrozen ? 'bg-emerald-500' : 'bg-rose-500'}`} />

              <div className={`relative mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl border ${
                isSystemFrozen 
                  ? 'bg-emerald-600/10 border-emerald-500/20 text-emerald-400' 
                  : 'bg-rose-600/10 border-rose-500/20 text-rose-400'
              }`}>
                <Icons.Snowflake className={`h-7 w-7 ${isSystemFrozen ? 'animate-spin' : 'animate-pulse'}`} />
              </div>

              <h2 className="font-display font-black tracking-widest text-white text-sm uppercase">
                {isSystemFrozen ? "CONFIRM SYSTEM RESTORATION" : "CONFIRM EMERGENCY SYSTEM FREEZE"}
              </h2>
              <p className="text-[9px] font-mono text-slate-500 mt-1 uppercase tracking-wider">
                {isSystemFrozen ? "De-escalate lock & resume active operations" : "halt active operations & lock API streams"}
              </p>

              <div className="mt-4 rounded-xl bg-slate-900/40 border border-slate-900/60 p-4 text-left font-sans text-xxs text-slate-400 space-y-2 leading-relaxed">
                {isSystemFrozen ? (
                  <>
                    <p>You are about to restore normal operations on the SupportPilot dashboard:</p>
                    <ul className="list-disc pl-4 space-y-1 text-slate-300">
                      <li>AI coprocessor background execution threads will resume polling and jobs.</li>
                      <li>Standard outgoing network API stream routing will be restored.</li>
                      <li>Telemetry graphs will return to live data synchronization.</li>
                    </ul>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-rose-400">WARNING: CRITICAL ADMINISTRATIVE OVERRIDE ACTION</p>
                    <p>Executing this freeze will immediately apply the following fail-safe measures:</p>
                    <ul className="list-disc pl-4 space-y-1 text-slate-300">
                      <li>Halt all active background AI coprocessor execution pools immediately.</li>
                      <li>Suspend all non-critical incoming and outgoing API requests to prevent state drift.</li>
                      <li>Establish a secure telemetry read-only lock across production Kubernetes namespaces.</li>
                    </ul>
                  </>
                )}
              </div>

              <div className="mt-6 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setIsFreezeModalOpen(false)}
                  className="flex-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xxs uppercase tracking-wider p-3 border border-slate-800 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextFrozenState = !isSystemFrozen;
                    setIsSystemFrozen(nextFrozenState);
                    setIsFreezeModalOpen(false);

                    if (nextFrozenState) {
                      handleAddAuditLog(
                        "Eshan Barua (CTO)",
                        "EMERGENCY SYSTEM FREEZE",
                        "System Kernel",
                        "SUCCESS",
                        "All active background coprocessor loops halted and non-critical outgoing API request streams suspended globally."
                      );
                      window.dispatchEvent(new CustomEvent('show-toast', {
                        detail: { message: "SYSTEM IN EMERGENCY FREEZE. ALL JOBS PAUSED." }
                      }));
                    } else {
                      handleAddAuditLog(
                        "Eshan Barua (CTO)",
                        "SYSTEM RESTORED",
                        "System Kernel",
                        "SUCCESS",
                        "All operational coprocessor background processes and standard API request routing successfully restored."
                      );
                      window.dispatchEvent(new CustomEvent('show-toast', {
                        detail: { message: "System operational routing successfully restored!" }
                      }));
                    }
                  }}
                  className={`flex-1 rounded-xl font-bold text-xxs uppercase tracking-wider p-3 border cursor-pointer transition-colors ${
                    isSystemFrozen
                      ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-600/10'
                      : 'bg-rose-600 hover:bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-600/10'
                  }`}
                >
                  {isSystemFrozen ? "Restore System" : "Confirm Freeze"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SYSTEM THEME PREFERENCE SUGGESTION TOAST */}
      <AnimatePresence>
        {themeSuggestion && (
          <motion.div
            initial={{ opacity: 0, x: 100, y: 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 80, y: 0 }}
            className="fixed bottom-6 right-6 z-50 rounded-xl border border-indigo-500/30 bg-slate-900/95 backdrop-blur-md p-4.5 shadow-2xl flex flex-col space-y-3 max-w-sm border-l-4 border-l-indigo-500"
          >
            <div className="flex items-start justify-between space-x-3">
              <div className="flex items-center space-x-2.5">
                <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-400 shrink-0">
                  <Icons.Palette className="h-4.5 w-4.5 animate-pulse" />
                </div>
                <div className="text-left">
                  <h4 className="text-xxs font-bold text-white uppercase tracking-wider">Theme Preference</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                    We detected your system prefers <span className="text-white font-semibold font-mono">{themeSuggestion === 'deepspace' ? 'Dark' : 'Light'}</span> mode. Would you like to switch to the corresponding <span className="text-indigo-400 font-semibold font-mono">{themeSuggestion === 'deepspace' ? 'Deep Space' : 'Zinc'}</span> theme?
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setThemeSuggestion(null);
                  localStorage.setItem('supportpilot_dismiss_theme_suggest', 'true');
                }}
                className="text-slate-500 hover:text-slate-300 p-0.5"
              >
                <Icons.X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex items-center space-x-2 justify-end">
              <button
                onClick={() => {
                  setThemeSuggestion(null);
                  localStorage.setItem('supportpilot_dismiss_theme_suggest', 'true');
                }}
                className="px-2.5 py-1 text-[9px] font-semibold text-slate-400 hover:text-white rounded border border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  handleSetTheme(themeSuggestion);
                  setThemeSuggestion(null);
                  localStorage.setItem('supportpilot_dismiss_theme_suggest', 'true');
                  setToastMessage(`Theme updated to ${themeSuggestion === 'deepspace' ? 'Deep Space' : 'Zinc'}.`);
                }}
                className="px-2.5 py-1 text-[9px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
              >
                Apply Theme
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Runbook Viewer Modal */}
      <AnimatePresence>
        {selectedSearchRunbook && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl rounded-2xl border border-slate-900 bg-slate-950 p-6 shadow-2xl font-sans"
            >
              <div className="flex items-center justify-between border-b border-slate-900 pb-4 mb-4">
                <div>
                  <span className="font-mono text-[9px] text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full font-bold">
                    {selectedSearchRunbook.id}
                  </span>
                  <h3 className="text-sm font-bold text-white mt-2">{selectedSearchRunbook.title}</h3>
                </div>
                <button
                  onClick={() => setSelectedSearchRunbook(null)}
                  className="rounded-lg bg-slate-900 hover:bg-slate-800 p-1.5 text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  <Icons.X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[350px] overflow-y-auto text-xs text-slate-300 font-mono leading-relaxed bg-slate-900/40 border border-slate-900/60 p-4 rounded-xl whitespace-pre-wrap select-text">
                {selectedSearchRunbook.content}
              </div>

              <div className="flex items-center justify-between border-t border-slate-900 pt-4 mt-4 text-[10px] text-slate-500 font-mono">
                <span>Author: {selectedSearchRunbook.author}</span>
                <span>Created: {new Date(selectedSearchRunbook.createdAt).toLocaleDateString()}</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default function App() {
  return (
    <SupportPilotProvider>
      <AppContent />
    </SupportPilotProvider>
  );
}

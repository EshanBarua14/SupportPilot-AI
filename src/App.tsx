import React, { useState, useEffect } from 'react';
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
import NotificationBell, { SystemNotification } from './components/NotificationBell';
import { SeedAuditTrail, ActiveUser, InitialIncidents, InitialKBArticles } from './data/simulation';
import { AuditLogEntry } from './types';
import * as Icons from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'workspace' | 'agents' | 'metrics' | 'runbooks' | 'settings' | 'audit' | 'aspnet'>('workspace');
  const [modelSelection, setModelSelection] = useState('gemini-3.5-flash');

  // Sidebar Layout Preferences with localStorage persistence
  const [isPinned, setIsPinned] = useState<boolean>(() => {
    const saved = localStorage.getItem('supportpilot_sidebar_pinned');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [sidebarMode, setSidebarMode] = useState<'slim' | 'hidden'>(() => {
    const saved = localStorage.getItem('supportpilot_sidebar_mode');
    return (saved as 'slim' | 'hidden') || 'slim';
  });

  const [isHovered, setIsHovered] = useState(false);

  // Sync sidebar preferences to local storage
  useEffect(() => {
    localStorage.setItem('supportpilot_sidebar_pinned', JSON.stringify(isPinned));
  }, [isPinned]);

  useEffect(() => {
    localStorage.setItem('supportpilot_sidebar_mode', sidebarMode);
  }, [sidebarMode]);

  // Manage appendable immutable audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    return SeedAuditTrail.map((log) => ({
      id: log.id,
      timestamp: log.timestamp,
      operator: log.operator,
      action: log.action,
      module: log.module,
      status: log.status,
      payload: log.payload
    }));
  });

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Full-Text Search Engine State
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchPreview, setShowSearchPreview] = useState(false);
  const [selectedSearchRunbook, setSelectedSearchRunbook] = useState<any>(null);

  // Unified full-text search index matching
  const getSearchResults = () => {
    if (!searchQuery.trim()) return { incidents: [], runbooks: [], audits: [] };
    const query = searchQuery.toLowerCase();

    const filteredIncidents = InitialIncidents.filter(inc => 
      inc.id.toLowerCase().includes(query) ||
      inc.title.toLowerCase().includes(query) ||
      inc.description.toLowerCase().includes(query) ||
      inc.appName.toLowerCase().includes(query) ||
      inc.severity.toLowerCase().includes(query) ||
      inc.status.toLowerCase().includes(query)
    );

    const filteredRunbooks = InitialKBArticles.filter(kb =>
      kb.id.toLowerCase().includes(query) ||
      kb.title.toLowerCase().includes(query) ||
      kb.content.toLowerCase().includes(query) ||
      kb.tags.some(t => t.toLowerCase().includes(query))
    );

    const filteredAudits = auditLogs.filter(aud =>
      aud.id.toLowerCase().includes(query) ||
      aud.operator.toLowerCase().includes(query) ||
      aud.action.toLowerCase().includes(query) ||
      aud.module.toLowerCase().includes(query) ||
      aud.payload.toLowerCase().includes(query)
    );

    return {
      incidents: filteredIncidents.slice(0, 3),
      runbooks: filteredRunbooks.slice(0, 3),
      audits: filteredAudits.slice(0, 3)
    };
  };

  const searchResults = getSearchResults();
  const hasSearchResults = searchResults.incidents.length > 0 || searchResults.runbooks.length > 0 || searchResults.audits.length > 0;

  // Security Lock Session State
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(900); // 15 mins = 900s
  const [themeSuggestion, setThemeSuggestion] = useState<string | null>(null);

  // Theme state and synchronizer
  const [theme, setTheme] = useState<string>(() => {
    return localStorage.getItem('supportpilot_theme') || 'slate';
  });

  const handleSetTheme = (newTheme: string) => {
    localStorage.setItem('supportpilot_theme', newTheme);
    document.documentElement.classList.remove('theme-slate', 'theme-zinc', 'theme-deepspace', 'theme-highcontrast');
    document.documentElement.classList.add(`theme-${newTheme}`);
    setTheme(newTheme);
    handleAddAuditLog(
      "Eshan Barua (CTO)", 
      "Update System Theme", 
      "UI Console", 
      "SUCCESS", 
      `Changed visual workspace layout template theme to: ${newTheme.toUpperCase()}`
    );
  };

  // SignalR Alerts and NotificationBell state
  const [notifications, setNotifications] = useState<SystemNotification[]>(() => {
    const saved = localStorage.getItem('supportpilot_notifications');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      {
        id: 'not_1',
        message: "Acme Billing Service pod terminated by Linux OOM manager. Outage ticket #inc_001 generated.",
        timestamp: new Date(Date.now() - 360000).toISOString(),
        read: false,
        type: 'system'
      },
      {
        id: 'not_2',
        message: "PostgreSQL transaction lock deadlock detected on thread PID 405.",
        timestamp: new Date(Date.now() - 720000).toISOString(),
        read: false,
        type: 'incident'
      },
      {
        id: 'not_3',
        message: "Connected client manager to ASP.NET Hub: /hubs/incidents. Listening on group 'Tenant-Global'.",
        timestamp: new Date(Date.now() - 1200000).toISOString(),
        read: true,
        type: 'info'
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('supportpilot_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const handleMarkAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setToastMessage("All real-time SignalR alerts marked as read.");
  };

  const handleMarkNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
    setToastMessage("SignalR alert log feed cleared.");
  };

  const handleSignalRAlert = (rawMessage: string) => {
    setToastMessage(rawMessage);
    
    let type: 'incident' | 'system' | 'info' = 'info';
    if (rawMessage.toLowerCase().includes('critical') || rawMessage.toLowerCase().includes('outage') || rawMessage.toLowerCase().includes('deadlock') || rawMessage.toLowerCase().includes('oom')) {
      type = 'system';
    } else if (rawMessage.toLowerCase().includes('incident')) {
      type = 'incident';
    }

    const message = rawMessage.replace(/^SignalR\s*\[[^\]]+\]:\s*/i, '');
    const newNotif: SystemNotification = {
      id: `not_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      message,
      timestamp: new Date().toISOString(),
      read: false,
      type
    };

    setNotifications(prev => [newNotif, ...prev]);
  };

  // Idle Timer logic - 15 minutes auto lock with active countdown feedback
  useEffect(() => {
    if (isLocked) return;

    const interval = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          setIsLocked(true);
          handleAddAuditLog(
            "System Security", 
            "Session Lock", 
            "Compliance Engine", 
            "SUCCESS", 
            "Session automatically locked due to 15 minutes of operational inactivity."
          );
          return 900;
        }
        return prev - 1;
      });
    }, 1000);

    const resetTimer = () => {
      setSecondsRemaining(900);
    };

    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    return () => {
      clearInterval(interval);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [isLocked]);

  // Hook detecting system theme preference & suggesting Deep Space or Zinc
  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const suggestedTheme = isDark ? 'deepspace' : 'zinc';
    const currentTheme = localStorage.getItem('supportpilot_theme') || 'slate';
    const dismissed = localStorage.getItem('supportpilot_dismiss_theme_suggest');
    
    if (currentTheme !== suggestedTheme && !dismissed) {
      setThemeSuggestion(suggestedTheme);
    }
  }, []);

  // Universal show-toast custom event listener
  useEffect(() => {
    const handleShowToast = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.message) {
        setToastMessage(customEvent.detail.message);
      }
    };
    window.addEventListener('show-toast', handleShowToast);
    return () => window.removeEventListener('show-toast', handleShowToast);
  }, []);

  // Load and apply theme from localStorage on initial boot
  useEffect(() => {
    const savedTheme = localStorage.getItem('supportpilot_theme') || 'slate';
    document.documentElement.classList.remove('theme-slate', 'theme-zinc', 'theme-deepspace', 'theme-highcontrast');
    document.documentElement.classList.add(`theme-${savedTheme}`);
  }, []);

  // Universal auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Keyboard shortcut listener for universal controls and accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command palette: Ctrl+K or Meta+K
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
        return;
      }

      // Help modal: '?' key
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        setIsShortcutsOpen(prev => !prev);
        return;
      }

      // Tab navigation shortcuts: Alt + key
      if (e.altKey) {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return;
        }
        
        const key = e.key.toLowerCase();
        if (key === 'w') {
          e.preventDefault();
          setActiveTab('aspnet');
          handleAddAuditLog("Eshan Barua (CTO)", "Shortcut Navigation", "Routing Engine", "SUCCESS", "Switched tab to C# ASP.NET Engine");
        } else if (key === 'i') {
          e.preventDefault();
          setActiveTab('workspace');
          handleAddAuditLog("Eshan Barua (CTO)", "Shortcut Navigation", "Routing Engine", "SUCCESS", "Focused Incident Workspace");
        } else if (key === 'p') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('toggle-priority-filter'));
          handleAddAuditLog("Eshan Barua (CTO)", "Shortcut Action", "Operational Workspace", "SUCCESS", "Toggled incident list priority filter");
        } else if (key === 'n') {
          e.preventDefault();
          setActiveTab('workspace');
          window.dispatchEvent(new CustomEvent('create-new-ticket'));
          handleAddAuditLog("Eshan Barua (CTO)", "Shortcut Action", "Operational Workspace", "SUCCESS", "Triggered manual incident ticket creation");
        } else if (key === 'k') {
          e.preventDefault();
          setActiveTab('runbooks');
          handleAddAuditLog("Eshan Barua (CTO)", "Shortcut Navigation", "Routing Engine", "SUCCESS", "Switched tab to Knowledge Base");
        } else if (key === 'a') {
          e.preventDefault();
          setActiveTab('agents');
          handleAddAuditLog("Eshan Barua (CTO)", "Shortcut Navigation", "Routing Engine", "SUCCESS", "Switched tab to AI Agent Matrix");
        } else if (key === 'm') {
          e.preventDefault();
          setActiveTab('metrics');
          handleAddAuditLog("Eshan Barua (CTO)", "Shortcut Navigation", "Routing Engine", "SUCCESS", "Switched tab to NOC & SLA Dashboard");
        } else if (key === 'd') {
          e.preventDefault();
          setIsPinned(prev => !prev);
          handleAddAuditLog("Eshan Barua (CTO)", "Shortcut Toggle", "UI Layout", "SUCCESS", "Toggled sidebar pinning state");
        } else if (key === 's') {
          e.preventDefault();
          setActiveTab('settings');
          handleAddAuditLog("Eshan Barua (CTO)", "Shortcut Navigation", "Routing Engine", "SUCCESS", "Switched tab to System Settings");
        } else if (key === 'u') {
          e.preventDefault();
          handleAddAuditLog("Eshan Barua (CTO)", "Manual Audit Seed", "Compliance Engine", "SUCCESS", "Triggered manual audit log entry creation via Alt+U shortcut");
          setToastMessage("Seeded manual audit entry in immutable ledger.");
          setTimeout(() => setToastMessage(null), 3000);
        } else if (key === 'r') {
          e.preventDefault();
          setToastMessage("Broadcasted live SignalR diagnostic ping to subscribers.");
          setTimeout(() => setToastMessage(null), 3000);
          handleAddAuditLog("Eshan Barua (CTO)", "SignalR Broadcast", "SignalR Engine", "SUCCESS", "Broadcasted live real-time ping to connected C# frontend and mobile clients");
        } else if (key === 'f') {
          e.preventDefault();
          document.getElementById('unified-search-input')?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAddAuditLog = (
    operator: string, 
    action: string, 
    module: string, 
    status: 'SUCCESS' | 'FAILED' | 'PENDING_APPROVAL', 
    payload: string
  ) => {
    const newLog: AuditLogEntry = {
      id: `aud_${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      operator,
      action,
      module,
      status,
      payload
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const handleExecuteCommandFromPalette = (commandName: string) => {
    setToastMessage(`Dispatched automation script: "${commandName}" to live cluster pods.`);
    setTimeout(() => setToastMessage(null), 4000);

    handleAddAuditLog(
      "Eshan Barua (CTO)",
      "Command Palette Exec",
      "Automation Engine",
      "SUCCESS",
      `Invoked global command shorthand: ${commandName}`
    );
  };

  // Sidebar dynamic metrics and properties
  const navigationItems = [
    { 
      id: 'workspace' as const, 
      label: 'Incident Workspace', 
      icon: Icons.Terminal, 
      badge: '2', 
      badgeColor: 'bg-rose-500/15 text-rose-400 border border-rose-500/30' 
    },
    { 
      id: 'agents' as const, 
      label: 'AI Agent Matrix', 
      icon: Icons.Bot, 
      badge: '19', 
      badgeColor: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30' 
    },
    { 
      id: 'metrics' as const, 
      label: 'NOC & SLA Dashboard', 
      icon: Icons.Zap, 
      badge: '98.4%', 
      badgeColor: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold' 
    },
    { id: 'runbooks' as const, label: 'Knowledge Base', icon: Icons.BookOpen },
    { id: 'settings' as const, label: 'System Settings', icon: Icons.Settings },
    { id: 'audit' as const, label: 'Audit & Index', icon: Icons.Shield },
    { 
      id: 'aspnet' as const, 
      label: 'C# ASP.NET Engine', 
      icon: Icons.Server, 
      badge: 'PROD', 
      badgeColor: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 font-semibold' 
    }
  ];

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
      
      {/* STEALTH SIDEBAR TRIGGER ZONE (When completely hidden and unpinned, hover left edge to trigger slideout) */}
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

          {/* Quick pin / collapse action shown when expanded */}
          {isCurrentlyExpanded && (
            <button
              onClick={() => setIsPinned(!isPinned)}
              className={`rounded-lg p-1.5 text-slate-500 hover:bg-slate-900 hover:text-white transition-all`}
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

        {/* NAVIGATION LIST */}
        <motion.nav 
          variants={{
            expanded: {
              transition: {
                staggerChildren: 0.05,
                delayChildren: 0.02
              }
            },
            collapsed: {
              transition: {
                staggerChildren: 0.02,
                staggerDirection: -1
              }
            }
          }}
          initial="collapsed"
          animate={isCurrentlyExpanded ? "expanded" : "collapsed"}
          className="flex-1 space-y-1 px-2.5 py-4 overflow-y-auto"
        >
          {navigationItems.map(item => {
            const Icon = item.icon;
            const isTabActive = activeTab === item.id;
            
            const buttonVariants = {
              expanded: {
                x: 0,
                opacity: 1,
                transition: { type: 'spring', stiffness: 350, damping: 25 }
              },
              collapsed: {
                x: 0,
                opacity: 0.9,
                transition: { duration: 0.15 }
              }
            };

            const labelVariants = {
              expanded: {
                opacity: 1,
                x: 0,
                transition: { type: 'spring', stiffness: 300, damping: 20 }
              },
              collapsed: {
                opacity: 0,
                x: -8,
                transition: { duration: 0.12 }
              }
            };

            const badgeVariants = {
              expanded: {
                scale: 1,
                opacity: 1,
                transition: { type: 'spring', stiffness: 400, damping: 15 }
              },
              collapsed: {
                scale: 0.8,
                opacity: 0,
                transition: { duration: 0.1 }
              }
            };

            return (
              <motion.button
                key={item.id}
                variants={buttonVariants}
                onClick={() => {
                  setActiveTab(item.id);
                  // Auto-collapse sidebar on click if in unpinned floating mode
                  if (!isPinned) setIsHovered(false);
                }}
                className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 transition-all text-left ${
                  isTabActive 
                    ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/15' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                }`}
                title={!isCurrentlyExpanded ? item.label : undefined}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <Icon className={`h-4.5 w-4.5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                    isTabActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'
                  }`} />
                  {isCurrentlyExpanded && (
                    <motion.span 
                      variants={labelVariants}
                      className="text-xs font-display font-medium whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </div>

                {/* Badges */}
                {item.badge && (
                  <div className="flex items-center shrink-0 pl-2">
                    {isCurrentlyExpanded ? (
                      <motion.span 
                        variants={badgeVariants}
                        className={`rounded px-1.5 py-0.5 text-[9px] font-mono leading-none ${item.badgeColor}`}
                      >
                        {item.badge}
                      </motion.span>
                    ) : (
                      // Tiny notification dot on collapsed iconic mode
                      <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse border border-slate-950" />
                    )}
                  </div>
                )}
              </motion.button>
            );
          })}
        </motion.nav>

        {/* SIDEBAR PREFERENCE SETTINGS CONTROL PANEL */}
        <div className="border-t border-slate-900/80 p-2.5 bg-slate-950">
          {/* Layout Quick Controllers */}
          <div className="flex items-center justify-around rounded-xl bg-slate-900/40 p-1 border border-slate-900/60 mb-2">
            <button
              onClick={() => setSidebarMode('slim')}
              className={`flex-1 flex justify-center py-1 rounded-lg transition-all ${
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
              className={`flex-1 flex justify-center py-1 rounded-lg transition-all ${
                sidebarMode === 'hidden' 
                  ? 'bg-slate-800 text-indigo-400 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Set Auto-Hide Mode to Fully Hidden / Invisible"
            >
              <Icons.EyeOff className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setIsPinned(!isPinned)}
              className={`flex-1 flex justify-center py-1 rounded-lg transition-all ${
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

      {/* DYNAMIC PUSH-BACK SPACER (Animates width in layout so content adjusts smoothly around pinned sidebar) */}
      <motion.div 
        animate={{ width: layoutSpacerWidth }}
        transition={{ type: 'spring', stiffness: 350, damping: 32 }}
        className="shrink-0 h-full hidden md:block"
      />

      {/* MAIN CONTENT AREA CONTAINER */}
      <div className="flex-1 h-full overflow-hidden flex flex-col min-w-0">
        
        {/* POLISHED ENTERPRISE SUB-HEADER */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-900 bg-slate-950/80 px-6 backdrop-blur-md">
          
          {/* Breadcrumbs indicating current operational panel context */}
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

           {/* Quick global command search and model state select */}
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
                  className="w-full rounded-xl border border-slate-900 bg-slate-950 py-2 pl-9 pr-8 text-xxs text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 text-slate-500 hover:text-slate-300"
                  >
                    <Icons.X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Search Preview Overlay Dropdown */}
              <AnimatePresence>
                {showSearchPreview && searchQuery.trim() && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowSearchPreview(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute right-0 left-0 mt-2 z-50 rounded-xl border border-slate-900 bg-slate-950 p-3.5 shadow-2xl backdrop-blur-xl max-h-[380px] overflow-y-auto font-mono text-[10px] w-[350px] md:w-[400px]"
                    >
                      <div className="flex items-center justify-between border-b border-slate-900/80 pb-2 mb-2">
                        <span className="text-slate-400 font-bold tracking-wider text-[8.5px] uppercase">Search Index Results</span>
                        <span className="text-[8px] text-slate-600">Showing top hits</span>
                      </div>

                      {!hasSearchResults ? (
                        <div className="py-6 text-center text-slate-500 italic">
                          No indexed records matching "{searchQuery}"
                        </div>
                      ) : (
                        <div className="space-y-3.5 select-none">
                          {/* INCIDENTS CATEGORY */}
                          {searchResults.incidents.length > 0 && (
                            <div>
                              <div className="text-[8px] font-bold text-rose-400 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                                <Icons.ShieldAlert className="h-3 w-3" />
                                <span>Active Incident Tickets ({searchResults.incidents.length})</span>
                              </div>
                              <div className="space-y-1">
                                {searchResults.incidents.map(inc => (
                                  <button
                                    key={inc.id}
                                    onClick={() => {
                                      setActiveTab('workspace');
                                      setShowSearchPreview(false);
                                      setToastMessage(`Focused workspace context on: ${inc.id}`);
                                    }}
                                    className="w-full text-left p-2 rounded-lg bg-slate-900/40 hover:bg-rose-500/10 border border-slate-900 hover:border-rose-500/20 transition-all block group"
                                  >
                                    <div className="flex items-center justify-between font-bold mb-0.5">
                                      <span className="text-slate-200 group-hover:text-rose-400 font-sans truncate">{inc.title}</span>
                                      <span className="text-[8px] text-rose-500 bg-rose-500/10 px-1.5 rounded shrink-0">{inc.severity}</span>
                                    </div>
                                    <p className="text-[9.5px] text-slate-500 line-clamp-1 leading-snug">{inc.description}</p>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* RUNBOOKS CATEGORY */}
                          {searchResults.runbooks.length > 0 && (
                            <div>
                              <div className="text-[8px] font-bold text-indigo-400 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                                <Icons.BookOpen className="h-3 w-3" />
                                <span>Knowledge Runbooks ({searchResults.runbooks.length})</span>
                              </div>
                              <div className="space-y-1">
                                {searchResults.runbooks.map(kb => (
                                  <button
                                    key={kb.id}
                                    onClick={() => {
                                      setSelectedSearchRunbook(kb);
                                      setShowSearchPreview(false);
                                    }}
                                    className="w-full text-left p-2 rounded-lg bg-slate-900/40 hover:bg-indigo-500/10 border border-slate-900 hover:border-indigo-500/20 transition-all block group"
                                  >
                                    <div className="flex items-center justify-between font-bold mb-0.5">
                                      <span className="text-slate-200 group-hover:text-indigo-400 font-sans truncate">{kb.title}</span>
                                      <span className="text-[8px] text-slate-500 font-normal">{kb.id}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {kb.tags.map(t => (
                                        <span key={t} className="text-[7.5px] bg-slate-950 text-slate-400 px-1 rounded">{t}</span>
                                      ))}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* AUDIT LOGS CATEGORY */}
                          {searchResults.audits.length > 0 && (
                            <div>
                              <div className="text-[8px] font-bold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                                <Icons.Shield className="h-3 w-3" />
                                <span>Immutable Audit Logs ({searchResults.audits.length})</span>
                              </div>
                              <div className="space-y-1">
                                {searchResults.audits.map(aud => (
                                  <button
                                    key={aud.id}
                                    onClick={() => {
                                      setActiveTab('audit');
                                      setShowSearchPreview(false);
                                      setToastMessage(`Navigated to Audit Panel for event: ${aud.id}`);
                                    }}
                                    className="w-full text-left p-2 rounded-lg bg-slate-900/40 hover:bg-emerald-500/10 border border-slate-900 hover:border-emerald-500/20 transition-all block group"
                                  >
                                    <div className="flex items-center justify-between font-bold mb-0.5">
                                      <span className="text-slate-200 group-hover:text-emerald-400 truncate font-sans">{aud.action}</span>
                                      <span className="text-[8.5px] text-slate-500">{aud.id}</span>
                                    </div>
                                    <p className="text-[9.5px] text-slate-500 line-clamp-1 leading-snug">{aud.payload}</p>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
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

        {/* LIVE SYSTEM INCIDENT ALERTS TICKER BAR */}
        <div className="flex h-8 shrink-0 items-center justify-between border-b border-rose-500/10 bg-rose-500/5 px-6 font-mono text-xxs text-rose-300">
          <div className="flex items-center space-x-2 overflow-hidden">
            <Icons.Bell className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
            <span className="font-bold shrink-0 text-rose-400">SYSTEM ALERTS:</span>
            <span className="truncate">Acme Billing Service pod terminated by Linux OOM manager. Outage ticket #inc_001 generated.</span>
          </div>
          <div className="hidden md:flex items-center space-x-4 shrink-0 font-mono">
            <span className="text-slate-500">Zone: prod-east-1</span>
            <span className="text-rose-400 font-semibold uppercase">ACTIVE OUTAGES: 2</span>
          </div>
        </div>

        {/* COMPONENT VIEWS PORT (With clean visual transitions) */}
        <main className="flex-1 overflow-hidden p-6 bg-slate-950">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="h-full w-full"
            >
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

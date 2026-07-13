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
import { SeedAuditTrail, ActiveUser } from './data/simulation';
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

  // Load and apply theme from localStorage on initial boot
  useEffect(() => {
    const savedTheme = localStorage.getItem('supportpilot_theme') || 'slate';
    document.documentElement.classList.remove('theme-slate', 'theme-zinc');
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
                  setToastMessage("Session secured. Operational dashboard in read-only lock.");
                  setTimeout(() => setToastMessage(null), 3000);
                }}
                className="text-slate-500 hover:text-indigo-400 p-1 rounded-lg hover:bg-slate-900"
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
          <div className="flex items-center space-x-2.5 text-xs">
            <Icons.Layers className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-slate-500 font-medium font-display">cluster-prod-1</span>
            <Icons.ChevronRight className="h-3 w-3 text-slate-600" />
            <div className="flex items-center space-x-1.5 text-white font-semibold font-display">
              <ActiveTabIcon className="h-3.5 w-3.5 text-indigo-400" />
              <span>{activeTabItem?.label}</span>
            </div>
          </div>

          {/* Quick global command search and model state select */}
          <div className="flex items-center space-x-3">
            
            {/* System Health Telemetry Dashboard */}
            <div className="hidden md:block">
              <SystemHealthPanel />
            </div>

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
        onAlert={setToastMessage}
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

    </div>
  );
}

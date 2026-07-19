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
import ErrorBoundary from './components/ErrorBoundary';
import { SidebarNavigation } from './components/SidebarNavigation';
import { AlertsTicker } from './components/AlertsTicker';

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
                  className="w-full rounded-xl border border-slate-900 bg-slate-950 py-2 pl-9 pr-8 text-xxs text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono animate-none"
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
                                    className="w-full text-left p-2 rounded-lg bg-slate-900/40 hover:bg-rose-500/10 border border-slate-900 hover:border-rose-500/20 transition-all block group cursor-pointer"
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
                                    className="w-full text-left p-2 rounded-lg bg-slate-900/40 hover:bg-indigo-500/10 border border-slate-900 hover:border-indigo-500/20 transition-all block group cursor-pointer"
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
                                    className="w-full text-left p-2 rounded-lg bg-slate-900/40 hover:bg-emerald-500/10 border border-slate-900 hover:border-emerald-500/20 transition-all block group cursor-pointer"
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

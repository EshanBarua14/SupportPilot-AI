import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuditLogEntry, AuthUser } from '../types';
import { SystemNotification } from '../components/NotificationBell';
import { SeedAuditTrail, ActiveUser, InitialIncidents, InitialKBArticles } from '../data/simulation';

export type TabType = 'workspace' | 'agents' | 'metrics' | 'runbooks' | 'settings' | 'audit' | 'aspnet';

export interface SupportPilotContextType {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  modelSelection: string;
  setModelSelection: (model: string) => void;
  isPinned: boolean;
  setIsPinned: (pinned: boolean | ((prev: boolean) => boolean)) => void;
  sidebarMode: 'slim' | 'hidden';
  setSidebarMode: (mode: 'slim' | 'hidden') => void;
  isHovered: boolean;
  setIsHovered: (hovered: boolean) => void;
  auditLogs: AuditLogEntry[];
  setAuditLogs: React.Dispatch<React.SetStateAction<AuditLogEntry[]>>;
  handleAddAuditLog: (
    operator: string,
    action: string,
    module: string,
    status: 'SUCCESS' | 'FAILED' | 'PENDING_APPROVAL',
    payload: string
  ) => void;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  isShortcutsOpen: boolean;
  setIsShortcutsOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  toastMessage: string | null;
  setToastMessage: (msg: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  showSearchPreview: boolean;
  setShowSearchPreview: (show: boolean) => void;
  selectedSearchRunbook: any;
  setSelectedSearchRunbook: (runbook: any) => void;
  isLocked: boolean;
  setIsLocked: (locked: boolean) => void;
  secondsRemaining: number;
  setSecondsRemaining: React.Dispatch<React.SetStateAction<number>>;
  themeSuggestion: string | null;
  setThemeSuggestion: (theme: string | null) => void;
  tickerAlerts: Array<{ id: string; message: string; zone: string; category: string }>;
  setTickerAlerts: React.Dispatch<React.SetStateAction<Array<{ id: string; message: string; zone: string; category: string }>>>;
  selectedTickerIds: string[];
  setSelectedTickerIds: React.Dispatch<React.SetStateAction<string[]>>;
  showBulkAlertPopover: boolean;
  setShowBulkAlertPopover: (show: boolean) => void;
  handleBulkAlertAction: (action: 'Acknowledge' | 'Dismiss') => void;
  theme: string;
  setTheme: (theme: string) => void;
  handleSetTheme: (newTheme: string) => void;
  uiDensity: 'compact' | 'spacious';
  setUiDensity: (density: 'compact' | 'spacious') => void;
  notifications: SystemNotification[];
  setNotifications: React.Dispatch<React.SetStateAction<SystemNotification[]>>;
  handleMarkAllNotificationsRead: () => void;
  handleMarkNotificationRead: (id: string) => void;
  handleClearAllNotifications: () => void;
  handleSignalRAlert: (rawMessage: string) => void;
  handleExecuteCommandFromPalette: (commandName: string) => void;
  searchResults: { incidents: any[]; runbooks: any[]; audits: any[] };
  hasSearchResults: boolean;
  isSystemFrozen: boolean;
  setIsSystemFrozen: (frozen: boolean) => void;
  currentUser: AuthUser;
  setCurrentUser: React.Dispatch<React.SetStateAction<AuthUser>>;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  handleLogout: () => void;
  handleLoginSuccess: (user: AuthUser, authMethod: 'password' | 'google' | 'phone_otp' | 'sso') => void;
}

const SupportPilotContext = createContext<SupportPilotContextType | undefined>(undefined);

export function useSupportPilot() {
  const context = useContext(SupportPilotContext);
  if (!context) {
    throw new Error('useSupportPilot must be used within a SupportPilotProvider');
  }
  return context;
}

interface SupportPilotProviderProps {
  children: ReactNode;
}

export function SupportPilotProvider({ children }: SupportPilotProviderProps) {
  const [activeTab, setActiveTab] = useState<TabType>('workspace');
  const [modelSelection, setModelSelection] = useState('gemini-3.6-flash');
  const [isSystemFrozen, setIsSystemFrozen] = useState(false);

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
      payload: log.payload,
    }));
  });

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Full-Text Search Engine State
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchPreview, setShowSearchPreview] = useState(false);
  const [selectedSearchRunbook, setSelectedSearchRunbook] = useState<any>(null);

  // Security Lock & Authentication Session State
  const [currentUser, setCurrentUser] = useState<AuthUser>(() => {
    const saved = localStorage.getItem('supportpilot_current_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      id: 'usr_cto_01',
      name: 'Eshan Barua (CTO)',
      email: 'eshanbaruabarua@gmail.com',
      role: 'Chief Technology Officer & Lead Security Auditor',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
      pod: 'SRE & Executive Operations',
      phone: '+1 (555) 019-2834',
      is2FAEnabled: true,
      authMethod: 'google',
    };
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(900); // 15 mins = 900s
  const [themeSuggestion, setThemeSuggestion] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('supportpilot_current_user', JSON.stringify(currentUser));
  }, [currentUser]);

  // Audit addition helper
  const handleAddAuditLog = useCallback((
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
      payload,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  }, []);

  const handleLogout = useCallback(() => {
    setIsAuthModalOpen(true);
    setIsLocked(true);
    setToastMessage(`Operator session for ${currentUser.name} signed out. Secure login required.`);
    handleAddAuditLog(
      currentUser.name,
      'USER_LOGOUT',
      'Authentication Engine',
      'SUCCESS',
      `Signed out user session (${currentUser.email}). Operational console locked.`
    );
  }, [currentUser, handleAddAuditLog]);

  const handleLoginSuccess = useCallback((user: AuthUser, authMethod: 'password' | 'google' | 'phone_otp' | 'sso') => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    setIsLocked(false);
    setSecondsRemaining(900);
    setToastMessage(`Welcome back, ${user.name}! Authenticated via ${authMethod.toUpperCase()}.`);
    handleAddAuditLog(
      user.name,
      'SESSION_AUTHENTICATED',
      'Authentication Engine',
      'SUCCESS',
      `Session authorized for ${user.email} (${user.role}) via ${authMethod.toUpperCase()}.`
    );
  }, [handleAddAuditLog]);

  // Live system alerts ticker state
  const [tickerAlerts, setTickerAlerts] = useState([
    { id: 'alt-01', message: "Acme Billing Service pod terminated by Linux OOM manager. Outage ticket #inc_001 generated.", zone: "prod-east-1", category: "OOM" },
    { id: 'alt-02', message: "PostgreSQL database connection pool limits exceeded (active: 98/100).", zone: "prod-east-1", category: "Database" },
    { id: 'alt-03', message: "Redis cache connection pool exhausted. Incoming queries queued.", zone: "prod-west-2", category: "Cache" },
    { id: 'alt-04', message: "Kafka consumer group billing-workers lagged by > 5000 messages.", zone: "prod-east-1", category: "Streaming" }
  ]);
  const [selectedTickerIds, setSelectedTickerIds] = useState<string[]>([]);
  const [showBulkAlertPopover, setShowBulkAlertPopover] = useState(false);

  const handleBulkAlertAction = useCallback((action: 'Acknowledge' | 'Dismiss') => {
    setSelectedTickerIds((currentSelected) => {
      if (currentSelected.length === 0) return currentSelected;
      const removedCount = currentSelected.length;

      // Filter out processed alerts
      setTickerAlerts((prev) => prev.filter((alt) => !currentSelected.includes(alt.id)));
      
      // Toast & Audit
      setToastMessage(`Successfully executed bulk ${action} for ${removedCount} active system alerts.`);

      handleAddAuditLog(
        "Eshan Barua (CTO)",
        `Bulk ${action} Alerts`,
        "System Monitoring",
        "SUCCESS",
        `Bulk processed (${action}) ${removedCount} high-priority system telemetry alerts from NOC ticker`
      );

      return [];
    });
    setShowBulkAlertPopover(false);
  }, [handleAddAuditLog]);

  // Theme state and synchronizer
  const [theme, setTheme] = useState<string>(() => {
    return localStorage.getItem('supportpilot_theme') || 'slate';
  });

  // UI Density state and synchronizer
  const [uiDensity, setUiDensity] = useState<'compact' | 'spacious'>(() => {
    return (localStorage.getItem('supportpilot_uidensity') as 'compact' | 'spacious') || 'compact';
  });

  const handleSetUiDensity = useCallback((newDensity: 'compact' | 'spacious') => {
    localStorage.setItem('supportpilot_uidensity', newDensity);
    setUiDensity(newDensity);
    handleAddAuditLog(
      "Eshan Barua (CTO)",
      "Update UI Density",
      "UI Console",
      "SUCCESS",
      `Changed visual layout density mode to: ${newDensity.toUpperCase()}`
    );
  }, [handleAddAuditLog]);

  const handleSetTheme = useCallback((newTheme: string) => {
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
  }, [handleAddAuditLog]);

  // SignalR Alerts and NotificationBell state
  const [notifications, setNotifications] = useState<SystemNotification[]>(() => {
    const saved = localStorage.getItem('supportpilot_notifications');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      {
        id: 'not_1',
        message: "Acme Billing Service pod terminated by Linux OOM manager. Outage ticket #inc_001 generated.",
        timestamp: new Date(Date.now() - 360000).toISOString(),
        read: false,
        type: 'system',
      },
      {
        id: 'not_2',
        message: "PostgreSQL transaction lock deadlock detected on thread PID 405.",
        timestamp: new Date(Date.now() - 720000).toISOString(),
        read: false,
        type: 'incident',
      },
      {
        id: 'not_3',
        message: "Connected client manager to ASP.NET Hub: /hubs/incidents. Listening on group 'Tenant-Global'.",
        timestamp: new Date(Date.now() - 1200000).toISOString(),
        read: true,
        type: 'info',
      },
    ];
  });

  useEffect(() => {
    localStorage.setItem('supportpilot_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const handleMarkAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setToastMessage("All real-time SignalR alerts marked as read.");
  }, []);

  const handleMarkNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const handleClearAllNotifications = useCallback(() => {
    setNotifications([]);
    setToastMessage("SignalR alert log feed cleared.");
  }, []);

  const handleSignalRAlert = useCallback((rawMessage: string) => {
    setToastMessage(rawMessage);

    let type: 'incident' | 'system' | 'info' = 'info';
    if (
      rawMessage.toLowerCase().includes('critical') ||
      rawMessage.toLowerCase().includes('outage') ||
      rawMessage.toLowerCase().includes('deadlock') ||
      rawMessage.toLowerCase().includes('oom')
    ) {
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
      type,
    };

    setNotifications((prev) => [newNotif, ...prev]);
  }, []);

  // Idle Timer logic - 15 minutes auto lock with active countdown feedback
  useEffect(() => {
    if (isLocked) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
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
    activityEvents.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    return () => {
      clearInterval(interval);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [isLocked, handleAddAuditLog]);

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

  const handleExecuteCommandFromPalette = useCallback((commandName: string) => {
    setToastMessage(`Dispatched automation script: "${commandName}" to live cluster pods.`);
    handleAddAuditLog(
      "Eshan Barua (CTO)",
      "Command Palette Exec",
      "Automation Engine",
      "SUCCESS",
      `Invoked global command shorthand: ${commandName}`
    );
  }, [handleAddAuditLog]);

  // Keyboard shortcut listener for universal controls and accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command palette: Ctrl+K or Meta+K
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Help modal: '?' key
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
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
          setIsPinned((prev) => !prev);
          handleAddAuditLog("Eshan Barua (CTO)", "Shortcut Toggle", "UI Layout", "SUCCESS", "Toggled sidebar pinning state");
        } else if (key === 's') {
          e.preventDefault();
          setActiveTab('settings');
          handleAddAuditLog("Eshan Barua (CTO)", "Shortcut Navigation", "Routing Engine", "SUCCESS", "Switched tab to System Settings");
        } else if (key === 'u') {
          e.preventDefault();
          handleAddAuditLog("Eshan Barua (CTO)", "Manual Audit Seed", "Compliance Engine", "SUCCESS", "Triggered manual audit log entry creation via Alt+U shortcut");
          setToastMessage("Seeded manual audit entry in immutable ledger.");
        } else if (key === 'r') {
          e.preventDefault();
          setToastMessage("Broadcasted live SignalR diagnostic ping to subscribers.");
          handleAddAuditLog("Eshan Barua (CTO)", "SignalR Broadcast", "SignalR Engine", "SUCCESS", "Broadcasted live real-time ping to connected C# frontend and mobile clients");
        } else if (key === 'f') {
          e.preventDefault();
          document.getElementById('unified-search-input')?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAddAuditLog]);

  // Unified full-text search index matching
  const getSearchResults = useCallback(() => {
    if (!searchQuery.trim()) return { incidents: [], runbooks: [], audits: [] };
    const query = searchQuery.toLowerCase();

    const filteredIncidents = InitialIncidents.filter(
      (inc) =>
        inc.id.toLowerCase().includes(query) ||
        inc.title.toLowerCase().includes(query) ||
        inc.description.toLowerCase().includes(query) ||
        inc.appName.toLowerCase().includes(query) ||
        inc.severity.toLowerCase().includes(query) ||
        inc.status.toLowerCase().includes(query)
    );

    const filteredRunbooks = InitialKBArticles.filter(
      (kb) =>
        kb.id.toLowerCase().includes(query) ||
        kb.title.toLowerCase().includes(query) ||
        kb.content.toLowerCase().includes(query) ||
        kb.tags.some((t) => t.toLowerCase().includes(query))
    );

    const filteredAudits = auditLogs.filter(
      (aud) =>
        aud.id.toLowerCase().includes(query) ||
        aud.operator.toLowerCase().includes(query) ||
        aud.action.toLowerCase().includes(query) ||
        aud.module.toLowerCase().includes(query) ||
        aud.payload.toLowerCase().includes(query)
    );

    return {
      incidents: filteredIncidents.slice(0, 3),
      runbooks: filteredRunbooks.slice(0, 3),
      audits: filteredAudits.slice(0, 3),
    };
  }, [searchQuery, auditLogs]);

  const searchResults = getSearchResults();
  const hasSearchResults =
    searchResults.incidents.length > 0 ||
    searchResults.runbooks.length > 0 ||
    searchResults.audits.length > 0;

  return (
    <SupportPilotContext.Provider
      value={{
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
        setAuditLogs,
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
        setTheme,
        handleSetTheme,
        uiDensity,
        setUiDensity: handleSetUiDensity,
        notifications,
        setNotifications,
        handleMarkAllNotificationsRead,
        handleMarkNotificationRead,
        handleClearAllNotifications,
        handleSignalRAlert,
        handleExecuteCommandFromPalette,
        searchResults,
        hasSearchResults,
        isSystemFrozen,
        setIsSystemFrozen,
        currentUser,
        setCurrentUser,
        isAuthModalOpen,
        setIsAuthModalOpen,
        handleLogout,
        handleLoginSuccess,
      }}
    >
      {children}
    </SupportPilotContext.Provider>
  );
}

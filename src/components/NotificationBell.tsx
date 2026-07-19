import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as Icons from 'lucide-react';

export interface SystemNotification {
  id: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'incident' | 'system' | 'info';
}

interface NotificationBellProps {
  notifications: SystemNotification[];
  onMarkAllAsRead: () => void;
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
}

export default function NotificationBell({
  notifications,
  onMarkAllAsRead,
  onMarkAsRead,
  onClearAll
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Handle outside click to close the dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format time helper
  const formatTimeAgo = (isoString: string) => {
    try {
      const past = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - past.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return past.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return 'Recent';
    }
  };

  const getNotificationIcon = (type: SystemNotification['type']) => {
    switch (type) {
      case 'incident':
        return <Icons.AlertOctagon className="h-4 w-4 text-rose-400" />;
      case 'system':
        return <Icons.ServerCrash className="h-4 w-4 text-amber-400" />;
      case 'info':
      default:
        return <Icons.Activity className="h-4 w-4 text-indigo-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* BELL TRIGGER BUTTON */}
      <button
        id="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-1.5 rounded-lg border transition-all cursor-pointer ${
          isOpen 
            ? 'bg-indigo-600/20 border-indigo-500/60 text-white' 
            : 'border-slate-900 bg-slate-900/40 text-slate-400 hover:text-white hover:border-slate-800'
        }`}
        title="Real-Time SignalR Alert Ticker"
      >
        <Icons.Bell className={`h-4 w-4 ${unreadCount > 0 ? 'animate-bounce' : ''}`} />
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white ring-2 ring-slate-950">
            {unreadCount}
          </span>
        )}
      </button>

      {/* DROPDOWN MENU */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="notification-bell-dropdown"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-2.5 w-80 rounded-xl border border-slate-800 bg-slate-950/95 shadow-2xl shadow-black/50 backdrop-blur-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-900 p-3.5 bg-slate-900/20">
              <div className="flex items-center space-x-2">
                <Icons.Wifi className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
                <span className="font-display font-bold text-xs text-white">SignalR Live Feed</span>
              </div>
              <div className="flex space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => {
                      onMarkAllAsRead();
                    }}
                    className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Mark All Read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={onClearAll}
                    className="text-[10px] font-bold text-slate-400 hover:text-rose-400 transition-colors border-l border-slate-800 pl-2 flex items-center space-x-0.5 cursor-pointer"
                    title="Dismiss All Alerts"
                  >
                    <Icons.CheckCheck className="h-3 w-3 mr-0.5" />
                    Dismiss All
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-900">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <div className="rounded-full bg-slate-900 p-2.5 text-slate-600 mb-2">
                    <Icons.BellOff className="h-5 w-5" />
                  </div>
                  <p className="text-xxs font-bold text-slate-400">Hub Silent</p>
                  <p className="text-[10px] text-slate-500 max-w-[200px] mt-1 leading-normal">
                    No active incident updates or system alerts received over SignalR tenant group.
                  </p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => !notif.read && onMarkAsRead(notif.id)}
                    className={`flex items-start space-x-3 p-3 transition-colors text-left cursor-pointer ${
                      notif.read 
                        ? 'bg-transparent hover:bg-slate-900/20' 
                        : 'bg-indigo-600/5 hover:bg-indigo-600/10 border-l-2 border-l-indigo-500'
                    }`}
                  >
                    {/* Icon Column */}
                    <div className="mt-0.5 shrink-0 rounded bg-slate-900 p-1.5 border border-slate-800">
                      {getNotificationIcon(notif.type)}
                    </div>

                    {/* Message Column */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[10px] leading-relaxed break-words ${
                        notif.read ? 'text-slate-400' : 'text-slate-200 font-medium'
                      }`}>
                        {notif.message}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[8px] font-mono text-slate-500">
                          {formatTimeAgo(notif.timestamp)}
                        </span>
                        {!notif.read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer status link */}
            <div className="border-t border-slate-900 bg-slate-900/30 p-2 flex items-center justify-between text-[9px] font-mono text-slate-500">
              <div className="flex items-center space-x-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>WS_UPGRADE: ACTIVE</span>
              </div>
              <span>Tenant: Global-Live</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

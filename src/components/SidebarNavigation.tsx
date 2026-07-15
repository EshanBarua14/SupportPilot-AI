import React from 'react';
import { motion } from 'motion/react';
import * as Icons from 'lucide-react';
import { TabType } from '../context/SupportPilotContext';

interface SidebarNavigationProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isCurrentlyExpanded: boolean;
  isPinned: boolean;
  setIsHovered: (hovered: boolean) => void;
}

const SidebarNavigationComponent: React.FC<SidebarNavigationProps> = ({
  activeTab,
  setActiveTab,
  isCurrentlyExpanded,
  isPinned,
  setIsHovered,
}) => {
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

  return (
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
            transition: { type: 'spring' as const, stiffness: 350, damping: 25 }
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
            transition: { type: 'spring' as const, stiffness: 300, damping: 20 }
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
            transition: { type: 'spring' as const, stiffness: 400, damping: 15 }
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
            className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 transition-all text-left cursor-pointer ${
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
  );
};

export const SidebarNavigation = React.memo(SidebarNavigationComponent);

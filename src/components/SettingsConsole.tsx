import React from 'react';
import { ActiveUser } from '../data/simulation';
import * as Icons from 'lucide-react';

interface SettingsConsoleProps {
  modelSelection: string;
  onSetModelSelection: (model: string) => void;
}

export default function SettingsConsole({ modelSelection, onSetModelSelection }: SettingsConsoleProps) {
  const user = ActiveUser;
  const [theme, setTheme] = React.useState(() => {
    return localStorage.getItem('supportpilot_theme') || 'slate';
  });

  const models = [
    { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", desc: "Optimal speed, high-fidelity L1/L2 triage, and rapid distributed trace searches." },
    { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview", desc: "Advanced logic, complex PostgreSQL deadlock reasoning, and L3 postmortem synthesis." }
  ];

  const integrations = [
    { name: "PostgreSQL Database", status: "CONNECTED", type: "Relational Index", desc: "Synchronized with primary ledger clusters." },
    { name: "ArgoCD / KubeAPI Tunnel", status: "CONNECTED", type: "DevOps Orchestrator", desc: "Automated container pod restart tunnels online." },
    { name: "Discord API webhook", status: "CONNECTED", type: "Communications Hub", desc: "Real-time ticket ingestion pipeline verified." },
    { name: "WhatsApp Business API", status: "CONNECTED", type: "CRM Notification", desc: "Secure messaging templates verified." },
    { name: "Slack Enterprise Space", status: "CONNECTED", type: "Chatops Channel", desc: "Listening on dedicated #incident-war-room channels." },
    { name: "Jira / Confluence Rest Bridge", status: "PENDING_KEY", type: "Project Mgmt", desc: "OAuth keys required to index past sprint issues." }
  ];

  return (
    <div className="grid h-[calc(100vh-130px)] grid-cols-12 gap-4 font-sans text-xs overflow-y-auto pr-1">
      
      {/* Left Column: Model swapper and User active spec */}
      <div className="col-span-6 space-y-4">
        
        {/* Model Selection block */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
          <h3 className="mb-2.5 font-display font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-800 pb-2">
            <Icons.Cpu className="h-4 w-4" />
            <span>AI Model Orchestrator Targets</span>
          </h3>
          <p className="text-xxs text-slate-400 mb-4 leading-relaxed">
            Configure the default underlying Gemini neural LLM models that back your L1, L2, and L3 support agent matrix.
          </p>

          <div className="space-y-3">
            {models.map(m => {
              const isActive = m.id === modelSelection;
              return (
                <button
                  key={m.id}
                  onClick={() => onSetModelSelection(m.id)}
                  className={`w-full text-left rounded-lg p-3.5 border transition-all ${
                    isActive 
                      ? 'bg-indigo-600/20 border-indigo-500/80' 
                      : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-800/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">{m.name}</span>
                    {isActive && (
                      <span className="rounded bg-indigo-500 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white uppercase">
                        ACTIVE TARGET
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{m.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* API secrets info card - compliant, no custom UI input keys fields */}
        <div className="rounded-xl border border-dashed border-indigo-500/30 bg-indigo-500/5 p-4">
          <h3 className="mb-2 font-display font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Icons.Lock className="h-4 w-4" />
            <span>Secrets & API Key Governance</span>
          </h3>
          <p className="text-xxs text-slate-300 leading-relaxed">
            SupportPilot AI securely retrieves environment keys and secrets server-side. 
            To change or authorize your primary <span className="font-mono text-indigo-300">GEMINI_API_KEY</span>:
          </p>
          <div className="mt-3.5 rounded border border-slate-800 bg-slate-950 p-3 font-mono text-[9px] text-slate-400 leading-relaxed">
            <div className="font-bold text-slate-300 mb-1">INSTRUCTIONS:</div>
            <div>1. Locate the <span className="text-white">Settings</span> button in Google AI Studio's sidebar.</div>
            <div>2. Open the <span className="text-white">Secrets</span> panel.</div>
            <div>3. Register your keys under <span className="text-indigo-400">GEMINI_API_KEY</span>.</div>
            <div>4. The platform will immediately inject them without code restarts.</div>
          </div>
        </div>

        {/* UI Presentation Theme Switcher */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
          <h3 className="mb-2.5 font-display font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-800 pb-2">
            <Icons.Palette className="h-4 w-4" />
            <span>UI Presentation & Theme Settings</span>
          </h3>
          <p className="text-xxs text-slate-400 mb-3.5 leading-relaxed">
            Customize the global visual appearance of SupportPilot. Choose between high-contrast Dark Slate or highly legible Neutral Zinc.
          </p>

          <div className="grid grid-cols-2 gap-3.5">
            <button
              onClick={() => {
                localStorage.setItem('supportpilot_theme', 'slate');
                document.documentElement.classList.remove('theme-slate', 'theme-zinc');
                document.documentElement.classList.add('theme-slate');
                setTheme('slate');
              }}
              className={`flex items-center space-x-2 rounded-lg p-2.5 border transition-all cursor-pointer ${
                theme === 'slate'
                  ? 'bg-indigo-600/20 border-indigo-500/80 text-white'
                  : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:bg-slate-800/30'
              }`}
            >
              <div className="h-3.5 w-3.5 rounded-full bg-slate-950 border border-slate-700" />
              <span className="font-bold text-xxs">Slate (Dark)</span>
            </button>

            <button
              onClick={() => {
                localStorage.setItem('supportpilot_theme', 'zinc');
                document.documentElement.classList.remove('theme-slate', 'theme-zinc');
                document.documentElement.classList.add('theme-zinc');
                setTheme('zinc');
              }}
              className={`flex items-center space-x-2 rounded-lg p-2.5 border transition-all cursor-pointer ${
                theme === 'zinc'
                  ? 'bg-indigo-600/20 border-indigo-500/80 text-white'
                  : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:bg-slate-800/30'
              }`}
            >
              <div className="h-3.5 w-3.5 rounded-full bg-white border border-slate-300" />
              <span className="font-bold text-xxs">Zinc (Light)</span>
            </button>
          </div>
        </div>

        {/* User profile parameters */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
          <h3 className="mb-3 font-display font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-800 pb-2">
            <Icons.User className="h-4 w-4" />
            <span>Active Operator Spec</span>
          </h3>
          <div className="space-y-2.5 font-mono text-[10px]">
            <div className="flex justify-between">
              <span className="text-slate-500">OPERATOR NAME</span>
              <span className="text-white font-semibold">{user.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">EMAIL IDENTITY</span>
              <span className="text-white">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ROLE GRADE</span>
              <span className="text-indigo-400 font-bold">{user.role}</span>
            </div>
            <div className="border-t border-slate-800/60 pt-2.5">
              <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Assigned Policy Permissions</div>
              <div className="flex flex-wrap gap-1">
                {user.permissions.map(p => (
                  <span key={p} className="rounded bg-slate-800 px-2 py-0.5 text-xxs text-indigo-300 border border-slate-700/50">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Right Column: Platform Integration Status & Marketplace */}
      <div className="col-span-6 space-y-4">
        
        {/* Integrations checklist */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
          <h3 className="mb-3 font-display font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-800 pb-2">
            <Icons.CheckCircle className="h-4 w-4" />
            <span>Platform Integration Status Matrix</span>
          </h3>

          <div className="grid grid-cols-1 gap-2">
            {integrations.map(int => (
              <div key={int.name} className="flex items-start justify-between rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white text-xxs">{int.name}</span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[8px] text-slate-400">
                      {int.type}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug">{int.desc}</p>
                </div>
                
                <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold ${
                  int.status === 'CONNECTED' 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {int.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* License parameters */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
          <h3 className="mb-2 font-display font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Icons.Award className="h-4 w-4" />
            <span>Enterprise Licensing Spec</span>
          </h3>
          <p className="text-xxs text-slate-400 mb-3.5 leading-relaxed">
            Your SupportPilot AI platform instance is registered under the active corporate agreement.
          </p>

          <div className="rounded-lg bg-slate-950/60 border border-slate-800/60 p-3 font-mono text-[10px] space-y-1 text-slate-300">
            <div>License Type: <span className="text-white font-bold">Infinite Cluster Enterprise Seats</span></div>
            <div>Tenant Isolation Level: <span className="text-white">Strict Row level Multi-Tenancy</span></div>
            <div>SLA Liability Threshold: <span className="text-emerald-400 font-bold">99.95% Guaranteed</span></div>
            <div>Support Desk Seats: <span className="text-white">Unlimited (Active: 19 agent modules)</span></div>
          </div>
        </div>

      </div>

    </div>
  );
}

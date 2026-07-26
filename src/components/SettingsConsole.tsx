import React from 'react';
import { ActiveUser } from '../data/simulation';
import * as Icons from 'lucide-react';
import { useSupportPilot } from '../context/SupportPilotContext';

interface SettingsConsoleProps {
  modelSelection: string;
  onSetModelSelection: (model: string) => void;
  theme: string;
  onSetTheme: (theme: string) => void;
  searchSoundEnabled?: boolean;
  onSetSearchSoundEnabled?: (enabled: boolean) => void;
}

export default function SettingsConsole({
  modelSelection,
  onSetModelSelection,
  theme,
  onSetTheme,
  searchSoundEnabled = true,
  onSetSearchSoundEnabled
}: SettingsConsoleProps) {
  const user = ActiveUser;
  const { uiDensity, setUiDensity } = useSupportPilot();

  const [infraEvents, setInfraEvents] = React.useState<Array<{ id: string; time: string; type: string; msg: string; level: 'info' | 'warn' | 'crit' }>>([
    { id: 'ev1', time: '14:02:11', type: 'Kubernetes', msg: "Auto-scaling trigger activated: scaled node pool 'prod-compute-3' from 4 to 6 nodes due to high telemetry queue depth.", level: 'info' },
    { id: 'ev2', time: '14:04:15', type: 'ArgoCD', msg: "Deployment status changed: 'billing-v2-api' successfully promoted to blue-green canary slot.", level: 'info' },
    { id: 'ev3', time: '14:05:03', type: 'Telemetry', msg: "Critical CPU heat spike detected on 'ingress-routing-0': Core temperature 87C, throttled by governor.", level: 'crit' },
    { id: 'ev4', time: '14:06:12', type: 'NOC Alert', msg: "Redis replication lag resolved on replica 'cache-west-2b'.", level: 'info' },
    { id: 'ev5', time: '14:06:29', type: 'Kubernetes', msg: "HorizontalPodAutoscaler scaling up replica-set 'support-router-v1' to 5 pods.", level: 'info' }
  ]);

  React.useEffect(() => {
    const templates = [
      { type: 'Kubernetes', level: 'info', msg: "Pod 'triage-helper-84fd5' successfully scheduled on node 'gke-prod-pool-2'." },
      { type: 'ArgoCD', level: 'info', msg: "Desynchronized manifest reconciled: ConfigMap 'env-configs' synced successfully." },
      { type: 'Telemetry', level: 'warn', msg: "Disk I/O warning: Write latency on 'psql-primary-disk' exceeded 12ms threshold." },
      { type: 'Gateway', level: 'info', msg: "Ingress proxy successfully refreshed Envoy SSL certificate mappings for *.supportpilot.com." },
      { type: 'Autoscaler', level: 'info', msg: "HorizontalPodAutoscaler completed cool-down sweep: scaled down 'ocr-worker-pool' to 1 instance." },
      { type: 'Hardware', level: 'crit', msg: "ECC memory single-bit error corrected on server node 'baremetal-04a' (DIMM_A2)." }
    ];

    const timer = setInterval(() => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      const randomTpl = templates[Math.floor(Math.random() * templates.length)];
      
      setInfraEvents(prev => [
        {
          id: `ev-${Date.now()}`,
          time: timeStr,
          type: randomTpl.type,
          msg: randomTpl.msg,
          level: randomTpl.level as any
        },
        ...prev
      ]);
    }, 10000);

    return () => clearInterval(timer);
  }, []);

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
            Customize the global visual appearance of SupportPilot. Choose between high-contrast Dark Slate, legible Light Zinc, immersive Deep Space, or Accessibility High Contrast.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onSetTheme('slate')}
              className={`flex items-center space-x-2 rounded-lg p-2.5 border transition-all cursor-pointer ${
                theme === 'slate'
                  ? 'bg-indigo-600/20 border-indigo-500/80 text-white font-bold'
                  : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:bg-slate-800/30'
              }`}
            >
              <div className="h-3 w-3 rounded-full bg-slate-950 border border-slate-700" />
              <span className="text-xxs">Slate (Dark)</span>
            </button>

            <button
              onClick={() => onSetTheme('zinc')}
              className={`flex items-center space-x-2 rounded-lg p-2.5 border transition-all cursor-pointer ${
                theme === 'zinc'
                  ? 'bg-indigo-600/20 border-indigo-500/80 text-white font-bold'
                  : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:bg-slate-800/30'
              }`}
            >
              <div className="h-3 w-3 rounded-full bg-white border border-slate-300" />
              <span className="text-xxs">Zinc (Light)</span>
            </button>

            <button
              onClick={() => onSetTheme('deepspace')}
              className={`flex items-center space-x-2 rounded-lg p-2.5 border transition-all cursor-pointer ${
                theme === 'deepspace'
                  ? 'bg-indigo-600/20 border-indigo-500/80 text-white font-bold'
                  : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:bg-slate-800/30'
              }`}
            >
              <div className="h-3 w-3 rounded-full bg-indigo-950 border border-indigo-500 animate-pulse" />
              <span className="text-xxs">Deep Space</span>
            </button>

            <button
              onClick={() => onSetTheme('highcontrast')}
              className={`flex items-center space-x-2 rounded-lg p-2.5 border transition-all cursor-pointer ${
                theme === 'highcontrast'
                  ? 'bg-indigo-600/20 border-indigo-500/80 text-white font-bold'
                  : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:bg-slate-800/30'
              }`}
            >
              <div className="h-3 w-3 rounded-full bg-black border border-white" />
              <span className="text-xxs">High Contrast</span>
            </button>
          </div>
        </div>

        {/* Search Audio Sound Effects Settings */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
          <h3 className="mb-2.5 font-display font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-800 pb-2">
            <Icons.Volume2 className="h-4 w-4 text-indigo-400" />
            <span>Search UI Sound Effects</span>
          </h3>
          <p className="text-xxs text-slate-400 mb-3.5 leading-relaxed">
            Toggle subtle audio feedback pings when search index results load in the search bar dropdown.
          </p>

          <div className="flex items-center justify-between rounded-lg bg-slate-950/60 p-3 border border-slate-800">
            <div className="flex items-center space-x-2.5">
              {searchSoundEnabled ? (
                <Icons.Volume2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <Icons.VolumeX className="h-4 w-4 text-slate-500" />
              )}
              <div>
                <div className="text-xxs font-bold text-white">Search Index Load Sound Ping</div>
                <div className="text-[9.5px] text-slate-400 font-mono">
                  {searchSoundEnabled ? 'Audio ping active on search result loads' : 'Search UI sounds muted'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSetSearchSoundEnabled?.(!searchSoundEnabled)}
              className={`px-3 py-1.5 rounded-lg text-xxs font-bold font-mono border transition-all cursor-pointer ${
                searchSoundEnabled
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {searchSoundEnabled ? 'ENABLED' : 'MUTED'}
            </button>
          </div>
        </div>

        {/* UI Layout Density Settings */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
          <h3 className="mb-2.5 font-display font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-800 pb-2">
            <Icons.LayoutGrid className="h-4 w-4 text-indigo-400" />
            <span>UI Layout Density Configuration</span>
          </h3>
          <p className="text-xxs text-slate-400 mb-3.5 leading-relaxed">
            Select your preferred interface layout density. Compact increases information density for expert operations. Spacious provides generous breathing room.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setUiDensity('compact')}
              className={`flex items-center space-x-2 rounded-lg p-2.5 border transition-all cursor-pointer ${
                uiDensity === 'compact'
                  ? 'bg-indigo-600/20 border-indigo-500/80 text-white font-bold'
                  : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:bg-slate-800/30'
              }`}
            >
              <Icons.Menu className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xxs">Compact (High Info)</span>
            </button>

            <button
              onClick={() => setUiDensity('spacious')}
              className={`flex items-center space-x-2 rounded-lg p-2.5 border transition-all cursor-pointer ${
                uiDensity === 'spacious'
                  ? 'bg-indigo-600/20 border-indigo-500/80 text-white font-bold'
                  : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:bg-slate-800/30'
              }`}
            >
              <Icons.LayoutList className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xxs">Spacious (Readable)</span>
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

        {/* Real-time System Activity Feed */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 flex flex-col h-[280px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
            <h3 className="font-display font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Icons.Activity className="h-4 w-4 text-emerald-400" />
              <span>System Activity Ingress</span>
            </h3>
            <span className="flex items-center space-x-1 font-mono text-[8px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE KUBE STREAM</span>
            </span>
          </div>
          
          <p className="text-xxs text-slate-400 mb-2.5 leading-relaxed">
            Real-time feed of underlying cloud infrastructure events, resource triggers, pod configurations, and scheduler states.
          </p>

          <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-2 bg-black/50 p-3 rounded-lg border border-slate-900 scrollbar-thin scrollbar-thumb-slate-800">
            {infraEvents.map((evt) => {
              let levelColor = 'text-slate-400';
              let badgeBg = 'bg-slate-800 text-slate-400';
              if (evt.level === 'warn') {
                levelColor = 'text-amber-400/90';
                badgeBg = 'bg-amber-500/10 border border-amber-500/20 text-amber-400';
              } else if (evt.level === 'crit') {
                levelColor = 'text-rose-400/90';
                badgeBg = 'bg-rose-500/15 border border-rose-500/30 text-rose-400';
              }
              return (
                <div key={evt.id} className="border-b border-slate-900/40 pb-1.5 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between text-[9px] mb-1">
                    <span className="text-slate-500 font-bold">[{evt.time}]</span>
                    <span className={`px-1 rounded text-[8px] font-bold uppercase ${badgeBg}`}>
                      {evt.type}
                    </span>
                  </div>
                  <p className={`leading-normal ${levelColor}`}>{evt.msg}</p>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}

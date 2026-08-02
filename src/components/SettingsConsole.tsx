import React, { useState, useEffect } from 'react';
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

export interface VoiceCommandRule {
  id: string;
  phrase: string;
  actionType: 'ASSIGN_ENGINEER' | 'SET_STATUS' | 'SNOOZE_INCIDENT' | 'SWITCH_TAB' | 'TRIGGER_RUNBOOK' | 'TOGGLE_CORRELATION';
  parameter: string;
  enabled: boolean;
}

export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  isPinned: boolean;
  uiDensity: 'compact' | 'standard' | 'spacious';
  showSlaHeader: boolean;
  showTicker: boolean;
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
  const {
    uiDensity,
    setUiDensity,
    uiSoundsEnabled,
    setUiSoundsEnabled,
    playUiSound,
    isPinned,
    setIsPinned,
    setActiveTab,
    setToastMessage,
    handleAddAuditLog
  } = useSupportPilot();

  const [settingsTab, setSettingsTab] = useState<'general' | 'voice' | 'layout' | 'integrations'>('general');

  // Listen for custom event from keyboard shortcuts to jump to settings sub-tab
  useEffect(() => {
    const handleSubTabEvent = (e: any) => {
      if (e.detail && ['general', 'voice', 'layout', 'integrations'].includes(e.detail)) {
        setSettingsTab(e.detail);
      }
    };
    window.addEventListener('switch-settings-tab', handleSubTabEvent);
    return () => window.removeEventListener('switch-settings-tab', handleSubTabEvent);
  }, []);

  // --- REQUIREMENT 1: CUSTOM VOICE COMMAND BUILDER STATE ---
  const [voiceRules, setVoiceRules] = useState<VoiceCommandRule[]>(() => {
    const saved = localStorage.getItem('supportpilot_custom_voice_commands');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: 'v1', phrase: 'assign ticket to sarah', actionType: 'ASSIGN_ENGINEER', parameter: 'Sarah Chen (L2)', enabled: true },
      { id: 'v2', phrase: 'mark status resolved', actionType: 'SET_STATUS', parameter: 'SOLVED', enabled: true },
      { id: 'v3', phrase: 'snooze incident 1 hour', actionType: 'SNOOZE_INCIDENT', parameter: '1h', enabled: true },
      { id: 'v4', phrase: 'show noc metrics', actionType: 'SWITCH_TAB', parameter: 'metrics', enabled: true },
      { id: 'v5', phrase: 'open correlation map', actionType: 'TOGGLE_CORRELATION', parameter: '', enabled: true }
    ];
  });

  const [newPhrase, setNewPhrase] = useState('');
  const [newActionType, setNewActionType] = useState<VoiceCommandRule['actionType']>('ASSIGN_ENGINEER');
  const [newParameter, setNewParameter] = useState('Sarah Chen (L2)');
  const [testVoiceInput, setTestVoiceInput] = useState('');
  const [testResult, setTestResult] = useState<{ matched: boolean; rule?: VoiceCommandRule; msg: string } | null>(null);

  useEffect(() => {
    localStorage.setItem('supportpilot_custom_voice_commands', JSON.stringify(voiceRules));
  }, [voiceRules]);

  const handleAddVoiceRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhrase.trim()) return;

    const rule: VoiceCommandRule = {
      id: `rule-${Date.now()}`,
      phrase: newPhrase.trim().toLowerCase(),
      actionType: newActionType,
      parameter: newParameter,
      enabled: true
    };

    setVoiceRules(prev => [rule, ...prev]);
    setNewPhrase('');
    setToastMessage(`Registered custom voice trigger: "${rule.phrase}"`);
    playUiSound('ding');
    handleAddAuditLog("Eshan Barua (CTO)", "Voice Command Mapped", "Voice Engine", "SUCCESS", `Mapped natural phrase "${rule.phrase}" to ${rule.actionType} (${rule.parameter})`);
  };

  const handleToggleRule = (id: string) => {
    setVoiceRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const handleDeleteRule = (id: string) => {
    setVoiceRules(prev => prev.filter(r => r.id !== id));
    setToastMessage("Deleted voice command mapping.");
  };

  // Test phrase matching against voice rules
  const handleTestVoiceCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testVoiceInput.trim()) return;

    const query = testVoiceInput.trim().toLowerCase();
    const matched = voiceRules.find(r => r.enabled && (query.includes(r.phrase) || r.phrase.includes(query)));

    if (matched) {
      setTestResult({
        matched: true,
        rule: matched,
        msg: `Match Found! Triggering Action: [${matched.actionType}] parameter: "${matched.parameter}"`
      });
      playUiSound('success');

      // Dispatch event or execute mapped action
      if (matched.actionType === 'SWITCH_TAB') {
        setActiveTab(matched.parameter as any);
      } else if (matched.actionType === 'TOGGLE_CORRELATION') {
        window.dispatchEvent(new CustomEvent('toggle-correlation-view'));
      } else {
        window.dispatchEvent(new CustomEvent('execute-voice-command', { detail: matched }));
      }

      setToastMessage(`Voice Trigger Executed: "${matched.phrase}"`);
      handleAddAuditLog("Eshan Barua (CTO)", "Voice Trigger Test", "Voice Engine", "SUCCESS", `Executed voice command "${query}" -> ${matched.actionType}`);
    } else {
      setTestResult({
        matched: false,
        msg: `No active voice rule matched phrase "${testVoiceInput}". Try "assign ticket to sarah" or "show noc metrics".`
      });
      playUiSound('ding');
    }
  };

  // --- REQUIREMENT 4: CUSTOM LAYOUT PRESETS STATE ---
  const DEFAULT_LAYOUT_PRESETS: LayoutPreset[] = [
    {
      id: 'preset-warroom',
      name: '🛡️ NOC War Room (Ultra-Dense)',
      description: 'Compact density with pinned sidebar, SLA header enabled, and live telemetry feed active.',
      isPinned: true,
      uiDensity: 'compact',
      showSlaHeader: true,
      showTicker: true
    },
    {
      id: 'preset-minimalist',
      name: '⚡ Minimalist Operator',
      description: 'Spacious UI with auto-collapsing sidebar for maximum focus on ticket text.',
      isPinned: false,
      uiDensity: 'spacious',
      showSlaHeader: false,
      showTicker: false
    },
    {
      id: 'preset-sre',
      name: '📊 SRE Analytics Focus',
      description: 'Standard density with pinned sidebar and live SLA telemetry metrics enabled.',
      isPinned: true,
      uiDensity: 'standard',
      showSlaHeader: true,
      showTicker: true
    }
  ];

  const [layoutPresets, setLayoutPresets] = useState<LayoutPreset[]>(() => {
    const saved = localStorage.getItem('supportpilot_layout_presets');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return DEFAULT_LAYOUT_PRESETS;
  });

  const [presetName, setPresetName] = useState('');
  const [presetDesc, setPresetDesc] = useState('');

  const handleApplyPreset = (preset: LayoutPreset) => {
    setIsPinned(preset.isPinned);
    setUiDensity(preset.uiDensity);
    setToastMessage(`Applied Layout Preset: "${preset.name}"`);
    playUiSound('assign');
    handleAddAuditLog("Eshan Barua (CTO)", "Layout Preset Applied", "UI Manager", "SUCCESS", `Applied UI layout configuration "${preset.name}" (Density: ${preset.uiDensity}, Pinned: ${preset.isPinned})`);
  };

  const handleSaveCurrentAsPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName.trim()) return;

    const newPreset: LayoutPreset = {
      id: `preset-${Date.now()}`,
      name: presetName.trim(),
      description: presetDesc.trim() || 'Custom user configured workspace layout preset.',
      isPinned: isPinned,
      uiDensity: uiDensity,
      showSlaHeader: true,
      showTicker: true
    };

    const updated = [newPreset, ...layoutPresets];
    setLayoutPresets(updated);
    localStorage.setItem('supportpilot_layout_presets', JSON.stringify(updated));
    setPresetName('');
    setPresetDesc('');
    setToastMessage(`Saved new layout preset: "${newPreset.name}"`);
    playUiSound('ding');
  };

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
    { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash", desc: "Optimal speed, high-fidelity L1/L2 triage, and rapid distributed trace searches." },
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
    <div className="flex flex-col h-[calc(100vh-130px)] space-y-4 font-sans text-xs overflow-y-auto pr-1">
      
      {/* Sub-Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 shrink-0">
        <button
          onClick={() => setSettingsTab('general')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
            settingsTab === 'general' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Icons.Sliders className="h-3.5 w-3.5" />
          <span>General & AI Models</span>
        </button>

        <button
          onClick={() => setSettingsTab('voice')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
            settingsTab === 'voice' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Icons.Mic className="h-3.5 w-3.5 text-amber-400" />
          <span>Voice Command Builder</span>
        </button>

        <button
          onClick={() => setSettingsTab('layout')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
            settingsTab === 'layout' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Icons.LayoutGrid className="h-3.5 w-3.5 text-emerald-400" />
          <span>Custom Layout Manager</span>
        </button>

        <button
          onClick={() => setSettingsTab('integrations')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
            settingsTab === 'integrations' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Icons.Activity className="h-3.5 w-3.5 text-cyan-400" />
          <span>Integrations & Telemetry</span>
        </button>
      </div>

      {/* SUB-TAB 1: GENERAL & AI MODELS */}
      {settingsTab === 'general' && (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-6 space-y-4">
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

            {/* API Secrets governance */}
            <div className="rounded-xl border border-dashed border-indigo-500/30 bg-indigo-500/5 p-4">
              <h3 className="mb-2 font-display font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Icons.Lock className="h-4 w-4" />
                <span>Secrets & API Key Governance</span>
              </h3>
              <p className="text-xxs text-slate-300 leading-relaxed">
                SupportPilot AI securely retrieves environment keys and secrets server-side.
              </p>
            </div>

            {/* Theme & Auditory */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
              <h3 className="mb-2.5 font-display font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-800 pb-2">
                <Icons.Palette className="h-4 w-4" />
                <span>UI Presentation & Theme Settings</span>
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onSetTheme('slate')}
                  className={`flex items-center space-x-2 rounded-lg p-2.5 border transition-all cursor-pointer ${
                    theme === 'slate' ? 'bg-indigo-600/20 border-indigo-500/80 text-white font-bold' : 'bg-slate-900/50 border-slate-800/80 text-slate-400'
                  }`}
                >
                  <div className="h-3 w-3 rounded-full bg-slate-950 border border-slate-700" />
                  <span className="text-xxs">Slate (Dark)</span>
                </button>
                <button
                  onClick={() => onSetTheme('zinc')}
                  className={`flex items-center space-x-2 rounded-lg p-2.5 border transition-all cursor-pointer ${
                    theme === 'zinc' ? 'bg-indigo-600/20 border-indigo-500/80 text-white font-bold' : 'bg-slate-900/50 border-slate-800/80 text-slate-400'
                  }`}
                >
                  <div className="h-3 w-3 rounded-full bg-white border border-slate-300" />
                  <span className="text-xxs">Zinc (Light)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column Operator spec */}
          <div className="col-span-12 lg:col-span-6 space-y-4">
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
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: CUSTOM VOICE COMMAND BUILDER */}
      {settingsTab === 'voice' && (
        <div className="grid grid-cols-12 gap-4">
          {/* Builder Form & Rule List */}
          <div className="col-span-12 lg:col-span-7 space-y-4">
            {/* Create New Voice Rule */}
            <div className="rounded-xl border border-indigo-500/30 bg-slate-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="font-display font-bold text-xs text-amber-400 uppercase tracking-wider flex items-center space-x-2">
                  <Icons.Mic className="h-4 w-4" />
                  <span>Custom Voice Command Builder</span>
                </h3>
                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[9px] font-mono font-bold border border-amber-500/20">
                  {voiceRules.filter(r => r.enabled).length} ACTIVE RULES
                </span>
              </div>

              <p className="text-[10px] text-slate-400">
                Map natural spoken or typed phrases to automated application actions (e.g. "Assign to Sarah", "Mark status solved", "Snooze 1 hour").
              </p>

              <form onSubmit={handleAddVoiceRule} className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono text-slate-300 uppercase font-bold">Spoken Trigger Phrase</label>
                    <input
                      type="text"
                      value={newPhrase}
                      onChange={(e) => setNewPhrase(e.target.value)}
                      placeholder='e.g., "escalate to p0"'
                      required
                      className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono text-slate-300 uppercase font-bold">Target Action</label>
                    <select
                      value={newActionType}
                      onChange={(e) => setNewActionType(e.target.value as any)}
                      className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="ASSIGN_ENGINEER">Assign to Engineer</option>
                      <option value="SET_STATUS">Transition Status</option>
                      <option value="SNOOZE_INCIDENT">Snooze Incident</option>
                      <option value="SWITCH_TAB">Switch View Tab</option>
                      <option value="TOGGLE_CORRELATION">Open Correlation Map</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono text-slate-300 uppercase font-bold">Action Parameter / Target Value</label>
                  <input
                    type="text"
                    value={newParameter}
                    onChange={(e) => setNewParameter(e.target.value)}
                    placeholder='e.g., "Sarah Chen (L2)" or "SOLVED" or "metrics"'
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center space-x-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 text-xs transition-all cursor-pointer shadow-lg shadow-indigo-600/25"
                >
                  <Icons.Plus className="h-4 w-4" />
                  <span>Register Voice Trigger Binding</span>
                </button>
              </form>
            </div>

            {/* Active Voice Rules Table */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 space-y-3">
              <h4 className="font-bold text-xs text-white uppercase font-mono tracking-wider">Registered Mapped Rules</h4>

              <div className="space-y-2">
                {voiceRules.map(rule => (
                  <div key={rule.id} className="flex items-center justify-between rounded-lg bg-slate-950 p-3 border border-slate-800/80">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <button
                        onClick={() => handleToggleRule(rule.id)}
                        className={`h-5 w-5 rounded-md flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                          rule.enabled ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400' : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        <Icons.Check className="h-3 w-3" />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-white text-xs flex items-center space-x-2">
                          <span className="text-amber-300 font-mono">"{rule.phrase}"</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 font-mono border border-indigo-500/20">
                            {rule.actionType}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Target Value: <span className="text-slate-200 font-bold">{rule.parameter || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 transition-colors cursor-pointer ml-2"
                      title="Delete voice rule"
                    >
                      <Icons.Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Voice Simulator & Live Testing Panel */}
          <div className="col-span-12 lg:col-span-5 space-y-4">
            <div className="rounded-xl border border-amber-500/30 bg-slate-950 p-4 space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
                <div className="h-8 w-8 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <Icons.Radio className="h-4 w-4 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-white font-display uppercase tracking-wider">
                    Voice Input Testing Sandbox
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">Simulate speech recognition or live voice commands.</p>
                </div>
              </div>

              <form onSubmit={handleTestVoiceCommand} className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    value={testVoiceInput}
                    onChange={(e) => setTestVoiceInput(e.target.value)}
                    placeholder='Type or say: "assign ticket to sarah"'
                    className="w-full rounded-xl bg-slate-900 border border-slate-800 pl-9 pr-24 py-3 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                  <Icons.Mic className="absolute left-3 top-3.5 h-4 w-4 text-amber-400 animate-pulse" />
                  <button
                    type="submit"
                    className="absolute right-2 top-2 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all cursor-pointer shadow"
                  >
                    Test Phrase
                  </button>
                </div>
              </form>

              {/* Preset Quick Test Pills */}
              <div className="space-y-1.5">
                <div className="text-[9px] font-mono text-slate-500 uppercase">Quick Test Presets:</div>
                <div className="flex flex-wrap gap-1.5">
                  {voiceRules.map(r => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setTestVoiceInput(r.phrase);
                      }}
                      className="px-2 py-1 rounded bg-slate-900 hover:bg-amber-500/10 border border-slate-800 hover:border-amber-500/40 text-[9.5px] font-mono text-amber-300 cursor-pointer transition-all"
                    >
                      "{r.phrase}"
                    </button>
                  ))}
                </div>
              </div>

              {/* Feedback Result Card */}
              {testResult && (
                <div className={`p-3 rounded-xl border font-mono text-[10px] space-y-1 ${
                  testResult.matched ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  <div className="font-bold uppercase flex items-center space-x-1.5">
                    {testResult.matched ? <Icons.CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Icons.AlertCircle className="h-4 w-4 text-rose-400" />}
                    <span>{testResult.matched ? 'MATCH SUCCESSFUL' : 'NO MATCH'}</span>
                  </div>
                  <p className="leading-relaxed">{testResult.msg}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: CUSTOM LAYOUT MANAGER */}
      {settingsTab === 'layout' && (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-7 space-y-4">
            {/* Active Layout Spec Box */}
            <div className="rounded-xl border border-emerald-500/30 bg-slate-950 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="font-display font-bold text-xs text-emerald-400 uppercase tracking-wider flex items-center space-x-2">
                  <Icons.LayoutGrid className="h-4 w-4" />
                  <span>Current Active UI Layout Spec</span>
                </h3>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-mono font-bold border border-emerald-500/20">
                  LIVE CONTEXT
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 font-mono text-[10px]">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-500 text-[9px]">SIDEBAR PIN STATE</div>
                  <div className="text-white font-bold text-xs mt-1">{isPinned ? 'PINNED (Expanded)' : 'AUTO-COLLAPSE'}</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-500 text-[9px]">UI DENSITY GRADE</div>
                  <div className="text-indigo-400 font-bold text-xs mt-1 uppercase">{uiDensity}</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-500 text-[9px]">AUDITORY SOUNDS</div>
                  <div className="text-emerald-400 font-bold text-xs mt-1">{uiSoundsEnabled ? 'ENABLED' : 'MUTED'}</div>
                </div>
              </div>

              {/* Save Current as Preset Form */}
              <form onSubmit={handleSaveCurrentAsPreset} className="space-y-3 pt-2 border-t border-slate-800">
                <div className="font-bold text-xs text-white font-mono uppercase">Save Current Config as New Layout Preset</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Preset Name (e.g., Night Shift On-Call)"
                    required
                    className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    value={presetDesc}
                    onChange={(e) => setPresetDesc(e.target.value)}
                    placeholder="Short description..."
                    className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center space-x-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 text-xs transition-all cursor-pointer shadow-lg shadow-emerald-600/25"
                >
                  <Icons.Save className="h-4 w-4" />
                  <span>Save Layout Preset</span>
                </button>
              </form>
            </div>

            {/* Presets Grid */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-white font-mono uppercase tracking-wider">Available Presets Catalog</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {layoutPresets.map(preset => (
                  <div key={preset.id} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 transition-all space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="font-bold text-white text-xs">{preset.name}</div>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{preset.description}</p>
                      <div className="flex items-center space-x-2 font-mono text-[9px] text-emerald-300 mt-2">
                        <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                          Density: {preset.uiDensity.toUpperCase()}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                          {preset.isPinned ? 'Sidebar Pinned' : 'Sidebar Auto'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleApplyPreset(preset)}
                      className="w-full mt-2 flex items-center justify-center space-x-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white font-bold py-1.5 text-xs transition-all cursor-pointer"
                    >
                      <Icons.CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Apply Preset</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-5 space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 space-y-3 font-mono text-[10px]">
              <h4 className="font-bold text-xs text-white uppercase">Layout Customizer Hints</h4>
              <p className="text-slate-400 leading-relaxed">
                Layout presets control sidebar pinning, Information density padding, and default dashboard widget displays. Use 1-click apply during incident war rooms or shift handovers.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: INTEGRATIONS & TELEMETRY */}
      {settingsTab === 'integrations' && (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-6 space-y-4">
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
          </div>

          <div className="col-span-12 lg:col-span-6 space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 flex flex-col h-[320px]">
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
              <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-2 bg-black/50 p-3 rounded-lg border border-slate-900">
                {infraEvents.map((evt) => (
                  <div key={evt.id} className="border-b border-slate-900/40 pb-1.5 last:border-0">
                    <div className="flex items-center justify-between text-[9px] mb-1">
                      <span className="text-slate-500 font-bold">[{evt.time}]</span>
                      <span className="px-1 rounded text-[8px] font-bold uppercase bg-slate-800 text-slate-400">
                        {evt.type}
                      </span>
                    </div>
                    <p className="leading-normal text-slate-300">{evt.msg}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

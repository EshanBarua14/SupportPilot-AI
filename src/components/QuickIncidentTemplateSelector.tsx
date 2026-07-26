import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { Incident } from '../types';

export interface IncidentTemplate {
  id: string;
  name: string;
  category: string;
  iconName: string;
  severity: Incident['severity'];
  appName: string;
  description: string;
  tags: string[];
  playbookSteps: string[];
}

export const INCIDENT_TEMPLATES: IncidentTemplate[] = [
  {
    id: 'tpl-postgres-lock',
    name: 'PostgreSQL Connection Lock Saturation',
    category: 'Database / Storage',
    iconName: 'Database',
    severity: 'CRITICAL',
    appName: 'Billing & Subscriptions Core',
    description: 'Active row lock contention on billing_invoices table. Downstream queries timing out after 3000ms. Connection pool exhausted (100/100).',
    tags: ['DB_LOCK', 'POSTGRES', 'POOL_EXHAUSTED', 'SLA_BREACH'],
    playbookSteps: [
      'Query pg_stat_activity to isolate long-running pid locks',
      'Terminate rogue backend queries using pg_terminate_backend(pid)',
      'Recycle active pgbouncer pool connections',
      'Verify query execution times normalize under 50ms'
    ]
  },
  {
    id: 'tpl-gateway-502',
    name: 'Ingress Gateway 502 Outage Surge',
    category: 'Networking / Gateway',
    iconName: 'Network',
    severity: 'HIGH',
    appName: 'Ingress Nginx Gateway',
    description: 'Upstream connection reset by peer. Elevated 502 Bad Gateway responses across primary ingress endpoints. Rate limiting threshold breached.',
    tags: ['502_BAD_GATEWAY', 'NGINX', 'RATE_LIMIT', 'NETWORK'],
    playbookSteps: [
      'Check Nginx error logs for upstream keepalive timeouts',
      'Temporarily double upstream keepalive connection buffer',
      'Restart ingress controller pods sequentially',
      'Inspect HTTP response status metrics on Datadog/Prometheus'
    ]
  },
  {
    id: 'tpl-oom-killed',
    name: 'K8s Container OOMKilled Memory Leak',
    category: 'Infrastructure / Pods',
    iconName: 'Cpu',
    severity: 'CRITICAL',
    appName: 'Auth Token Service',
    description: 'Pod container memory exceeded 2.0Gi cgroup limit. Node kernel terminated container process with OOMKilled status code 137.',
    tags: ['OOMKILLED', 'KUBERNETES', 'MEMORY_LEAK', 'CRASH_LOOP'],
    playbookSteps: [
      'Inspect heap memory dump artifacts in Cloud Storage',
      'Patch deployment memory limits from 2Gi to 4Gi in helm values',
      'Trigger rolling restart of deployment replica set',
      'Verify garbage collection activity in Node.js runtime metrics'
    ]
  },
  {
    id: 'tpl-webhook-timeout',
    name: 'Third-Party Shipping Webhook Timeout Surge',
    category: 'Integrations / API',
    iconName: 'Webhook',
    severity: 'MEDIUM',
    appName: 'Carrier Webhook Relay',
    description: 'External carrier shipping partner API responding with >5000ms latency. Webhook retry queues filling up in RabbitMQ.',
    tags: ['WEBHOOK_TIMEOUT', 'THIRD_PARTY', 'RABBITMQ', 'LATENCY'],
    playbookSteps: [
      'Enable fallback circuit breaker for external carrier endpoint',
      'Scale RabbitMQ consumer workers to drain backlogged queues',
      'Notify Carrier Support of API latency SLA breach',
      'Monitor queue depth in RabbitMQ management portal'
    ]
  }
];

interface QuickIncidentTemplateSelectorProps {
  onApplyTemplate: (template: IncidentTemplate) => void;
}

export const QuickIncidentTemplateSelector: React.FC<QuickIncidentTemplateSelectorProps> = ({ onApplyTemplate }) => {
  const [selectedId, setSelectedId] = useState<string>('');

  const handleSelect = (tpl: IncidentTemplate) => {
    setSelectedId(tpl.id);
    onApplyTemplate(tpl);
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message: `Applied Template: "${tpl.name}"` }
    }));
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 font-mono space-y-3 my-2">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <Icons.BookOpen className="h-3.5 w-3.5" />
          </div>
          <div>
            <h4 className="font-display font-bold text-xs text-white uppercase tracking-wider">
              Quick Incident Pattern Templates
            </h4>
            <p className="text-[9.5px] text-slate-400">Pre-fill investigation workflows & diagnostic metrics for recurring outages</p>
          </div>
        </div>
      </div>

      {/* Grid of Templates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {INCIDENT_TEMPLATES.map(tpl => {
          const isSelected = selectedId === tpl.id;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => handleSelect(tpl)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between space-y-2 ${
                isSelected
                  ? 'bg-indigo-600/20 border-indigo-500 text-white ring-2 ring-indigo-500/40 shadow-lg'
                  : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 text-slate-300'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[9px] uppercase font-bold">
                  <span className="text-slate-400">{tpl.category}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[8px] ${
                    tpl.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {tpl.severity}
                  </span>
                </div>

                <div className="font-sans font-bold text-xs text-white leading-tight">
                  {tpl.name}
                </div>
              </div>

              <div className="flex flex-wrap gap-1 pt-1">
                {tpl.tags.slice(0, 2).map(tag => (
                  <span key={tag} className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                    #{tag}
                  </span>
                ))}
              </div>

              <div className="text-[9px] font-mono font-bold text-indigo-400 flex items-center space-x-1 pt-1 border-t border-slate-800/60">
                <Icons.Zap className="h-3 w-3 text-indigo-400" />
                <span>Apply Template</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Centralized Gemini Model Routing Configuration for SupportPilot AI.
 * Source of truth for model definitions, routing, and fallback policies.
 */

export const MODEL_ROUTING = {
  // Primary stable model for general L1/L2 incident triage and correlation
  primary: 'gemini-3.6-flash',
  
  // Advanced reasoning model for deep L3 postmortems, root cause analysis, and deadlock investigation
  reasoning: 'gemini-3.1-pro-preview',
  
  // High-throughput, low-latency model for rapid tagging and search queries
  fast: 'gemini-3.1-flash-lite',
  
  // Tier-1 fallback model during rate-limiting or service degradation
  fallback: 'gemini-flash-latest',
  
  // Deterministic local heuristic engine when all cloud models are unavailable or unconfigured
  deterministicFallback: 'heuristic-engine'
} as const;

export type ModelId = typeof MODEL_ROUTING[keyof typeof MODEL_ROUTING];

export interface ModelMetadata {
  id: string;
  name: string;
  tier: 'production' | 'preview' | 'fallback' | 'local';
  description: string;
  contextWindow: string;
  recommendedFor: string;
}

export const AVAILABLE_MODELS: ModelMetadata[] = [
  {
    id: MODEL_ROUTING.primary,
    name: 'Gemini 3.6 Flash (Production)',
    tier: 'production',
    description: 'Ultra-fast, high-accuracy model optimized for high-throughput L1/L2 triage and trace synthesis.',
    contextWindow: '1M tokens',
    recommendedFor: 'Live telemetry triage, auto-tagging, incident correlation'
  },
  {
    id: MODEL_ROUTING.reasoning,
    name: 'Gemini 3.1 Pro Preview',
    tier: 'preview',
    description: 'High-reasoning frontier model for complex multi-service deadlock forensics and architecture analysis.',
    contextWindow: '2M tokens',
    recommendedFor: 'L3 deep investigation, post-incident runbook synthesis'
  },
  {
    id: MODEL_ROUTING.fast,
    name: 'Gemini 3.1 Flash-Lite',
    tier: 'production',
    description: 'Lightweight model designed for sub-second responses on tag extraction and log filters.',
    contextWindow: '1M tokens',
    recommendedFor: 'Log query suggestions, instant classification'
  },
  {
    id: MODEL_ROUTING.fallback,
    name: 'Gemini Flash Latest (Dynamic Alias)',
    tier: 'fallback',
    description: 'Reliability fallback route pointing to the latest operational Flash version.',
    contextWindow: '1M tokens',
    recommendedFor: 'Automated fallback routing during regional quota spikes'
  }
];

export function validateModelId(modelId: string): string {
  const allowed = [
    MODEL_ROUTING.primary,
    MODEL_ROUTING.reasoning,
    MODEL_ROUTING.fast,
    MODEL_ROUTING.fallback,
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash'
  ];
  if (allowed.includes(modelId as any)) {
    return modelId;
  }
  if (modelId && modelId.toLowerCase().includes('pro')) {
    return MODEL_ROUTING.reasoning;
  }
  return MODEL_ROUTING.primary;
}

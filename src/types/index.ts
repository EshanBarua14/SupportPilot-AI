export type SeverityType = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'SOLVED' | 'ESCALATED';
export type SourceChannel = 'Discord' | 'Slack' | 'WhatsApp' | 'Teams' | 'Email' | 'Jira';

export interface Tenant {
  id: string;
  name: string;
  industry: string;
  tier: 'ENTERPRISE' | 'PREMIUM' | 'STANDARD';
  productStack: string[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'CTO' | 'L1_ENGINEER' | 'L2_ENGINEER' | 'L3_ENGINEER' | 'ADMIN';
  permissions: string[];
}

export interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  source: string;
  message: string;
}

export interface MetricPoint {
  time: string;
  value: number;
}

export interface MetricSeries {
  label: string;
  unit: string;
  points: MetricPoint[];
}

export interface TraceNode {
  id: string;
  name: string;
  durationMs: number;
  status: 'SUCCESS' | 'ERROR' | 'WARNING';
  timestamp: string;
  children?: TraceNode[];
}

export interface DatabaseState {
  connectionsActive: number;
  poolLimit: number;
  locksCount: number;
  slowQueries: Array<{ query: string; durationMs: number }>;
}

export interface ApiCallSimulator {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  status: number;
  latencyMs: number;
}

export interface QueueState {
  queueName: string;
  messageCount: number;
  consumerCount: number;
  unackedCount: number;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  type: 'TELEMETRY' | 'SYSTEM' | 'AI_REASONING' | 'ACTION' | 'USER_NOTE';
  agent?: string;
}

export interface AIAnalysis {
  rootCause: string;
  confidenceScore: number;
  suggestedFix: string;
  summary: string;
  riskPrediction: string;
  timeline: TimelineEvent[];
}

export interface Incident {
  id: string;
  tenantId: string;
  title: string;
  severity: SeverityType;
  status: IncidentStatus;
  assignee: string;
  createdAt: string;
  appName: string;
  description: string;
  slaLimitMins: number;
  slaRemainingSecs: number;
  source: SourceChannel;
  customerName: string;
  customerProfile: string;
  
  // Dynamic logs, metrics, traces, database schemas, and state
  logs: LogEntry[];
  metrics: MetricSeries[];
  traces: TraceNode[];
  dbState: DatabaseState;
  apiCalls: ApiCallSimulator[];
  queueState: QueueState;
  
  // AI Generated / Interactive components
  analysis?: AIAnalysis;
  automaticReply?: string;
  csatScore?: number;
  lastModifiedBy?: string;
  statusHistory?: Array<{ status: 'OPEN' | 'INVESTIGATING' | 'SOLVED' | 'ESCALATED'; timestamp: string; changedBy: string; message?: string }>;
}

export interface SupportAgent {
  id: string;
  name: string;
  icon: string;
  description?: string;
  role: string;
  objectives: string[];
  permissions: string[];
  tools: string[];
  memory: string[];
  systemInstruction: string;
  reasoningLog?: string;
  isActive: boolean;
  metrics?: {
    avgEfficiency: number;
    avgResponseTimeMs: number;
    successfulRuns: number;
    failedRuns: number;
  };
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  operator: string;
  action: string;
  module: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING_APPROVAL';
  payload: string;
}

export interface KBArticle {
  id: string;
  title: string;
  content: string;
  tags: string[];
  author: string;
  createdAt: string;
  votes: number;
}

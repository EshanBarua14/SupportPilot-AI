import { Incident, SeverityType, IncidentStatus } from '../types';

/**
 * Valid lifecycle transitions for an Incident.
 * OPEN -> INVESTIGATING -> SOLVED or ESCALATED
 * SOLVED -> OPEN (Re-open with audit rationale)
 * ESCALATED -> INVESTIGATING or SOLVED
 */
export const ALLOWED_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  OPEN: ['INVESTIGATING', 'ESCALATED'],
  INVESTIGATING: ['SOLVED', 'ESCALATED', 'OPEN'],
  ESCALATED: ['INVESTIGATING', 'SOLVED'],
  SOLVED: ['OPEN'] // Allows explicit reopening
};

export function isValidTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateIncidentTransition(
  incident: Pick<Incident, 'id' | 'status'>,
  nextStatus: IncidentStatus,
  operatorRole?: string
): { valid: boolean; reason?: string } {
  if (incident.status === nextStatus) {
    return { valid: true };
  }

  // Role check: READ_ONLY can never transition status
  if (operatorRole === 'READ_ONLY') {
    return {
      valid: false,
      reason: 'Operators with READ_ONLY permission cannot alter incident status.'
    };
  }

  // Escalation / Solving to P0 might require L2 or higher
  if (nextStatus === 'SOLVED' && operatorRole === 'L1_ENGINEER') {
    return {
      valid: false,
      reason: 'L1 Engineers cannot unilaterally mark an incident as SOLVED without L2+ sign-off.'
    };
  }

  if (!isValidTransition(incident.status, nextStatus)) {
    return {
      valid: false,
      reason: `Invalid transition from ${incident.status} to ${nextStatus}. Allowed: ${ALLOWED_TRANSITIONS[incident.status]?.join(', ')}`
    };
  }

  return { valid: true };
}

/**
 * Calculate SLA time remaining in seconds and breach status.
 */
export function calculateSlaStatus(
  createdAtIso: string,
  slaLimitMins: number,
  currentTimeMs: number = Date.now()
): {
  limitSecs: number;
  elapsedSecs: number;
  remainingSecs: number;
  isBreached: boolean;
  pctElapsed: number;
  formattedRemaining: string;
} {
  const createdMs = new Date(createdAtIso).getTime();
  const validCreatedMs = isNaN(createdMs) ? currentTimeMs : createdMs;
  const elapsedSecs = Math.max(0, Math.floor((currentTimeMs - validCreatedMs) / 1000));
  const limitSecs = Math.max(60, slaLimitMins * 60);
  const remainingSecs = Math.max(0, limitSecs - elapsedSecs);
  const isBreached = elapsedSecs >= limitSecs;
  const pctElapsed = Math.min(100, Math.round((elapsedSecs / limitSecs) * 100));

  const mins = Math.floor(remainingSecs / 60);
  const secs = remainingSecs % 60;
  const formattedRemaining = isBreached
    ? `BREACHED (-${Math.floor((elapsedSecs - limitSecs) / 60)}m)`
    : `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;

  return {
    limitSecs,
    elapsedSecs,
    remainingSecs,
    isBreached,
    pctElapsed,
    formattedRemaining
  };
}

/**
 * Calculate Mean Time To Resolution (MTTR) in minutes.
 */
export function calculateMttr(
  resolvedIncidents: Array<{ createdAt: string; resolvedAt?: string }>
): number {
  if (!resolvedIncidents || resolvedIncidents.length === 0) return 0;

  const validDurations = resolvedIncidents
    .map((inc) => {
      const created = new Date(inc.createdAt).getTime();
      const resolved = inc.resolvedAt ? new Date(inc.resolvedAt).getTime() : Date.now();
      if (isNaN(created) || isNaN(resolved) || resolved < created) return 0;
      return (resolved - created) / (1000 * 60); // minutes
    })
    .filter((d) => d > 0);

  if (validDurations.length === 0) return 0;
  const total = validDurations.reduce((sum, val) => sum + val, 0);
  return Math.round((total / validDurations.length) * 10) / 10;
}

/**
 * Filter incidents by search text, severity, status, and appName.
 */
export function filterIncidents(
  incidents: Incident[],
  filters: {
    query?: string;
    severity?: SeverityType | 'ALL';
    status?: IncidentStatus | 'ALL';
    appName?: string | 'ALL';
    tenantId?: string;
  }
): Incident[] {
  if (!Array.isArray(incidents)) return [];

  const q = (filters.query || '').trim().toLowerCase();

  return incidents.filter((inc) => {
    // Tenant filter if present
    if (filters.tenantId && inc.tenantId !== filters.tenantId) {
      return false;
    }

    // Severity filter
    if (filters.severity && filters.severity !== 'ALL' && inc.severity !== filters.severity) {
      return false;
    }

    // Status filter
    if (filters.status && filters.status !== 'ALL' && inc.status !== filters.status) {
      return false;
    }

    // AppName filter
    if (filters.appName && filters.appName !== 'ALL' && inc.appName !== filters.appName) {
      return false;
    }

    // Search query matching title, description, appName, tags, customerName, or id
    if (q) {
      const inId = (inc.id || '').toLowerCase().includes(q);
      const inTitle = (inc.title || '').toLowerCase().includes(q);
      const inDesc = (inc.description || '').toLowerCase().includes(q);
      const inApp = (inc.appName || '').toLowerCase().includes(q);
      const inCustomer = (inc.customerName || '').toLowerCase().includes(q);
      const inTags = (inc.tags || []).some((t) => t.toLowerCase().includes(q));

      if (!inId && !inTitle && !inDesc && !inApp && !inCustomer && !inTags) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Cryptographic Audit Hash Chaining (SHA-256 simulation in pure TS / Web Crypto compatible)
 * Allows client and server to verify tamper-evidence of the audit trail.
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export function computeAuditHash(entry: {
  id: string;
  timestamp: string;
  operator: string;
  action: string;
  module: string;
  payload: string;
  previousHash: string;
}): string {
  const payloadToHash = `${entry.id}|${entry.timestamp}|${entry.operator}|${entry.action}|${entry.module}|${entry.payload}|${entry.previousHash}`;
  return simpleHash(payloadToHash);
}

export function verifyAuditChain(
  chain: Array<{
    id: string;
    timestamp: string;
    operator: string;
    action: string;
    module: string;
    payload: string;
    hash: string;
    previousHash: string;
  }>
): { isValid: boolean; brokenAtId?: string; index?: number } {
  if (!chain || chain.length === 0) return { isValid: true };

  for (let i = 0; i < chain.length; i++) {
    const current = chain[i];
    if (i === 0) {
      if (!current.previousHash.startsWith('GENESIS_BLOCK_')) {
        return { isValid: false, brokenAtId: current.id, index: i };
      }
    } else {
      if (current.previousHash !== chain[i - 1].hash) {
        return { isValid: false, brokenAtId: current.id, index: i };
      }
    }
    const computed = computeAuditHash({
      id: current.id,
      timestamp: current.timestamp,
      operator: current.operator,
      action: current.action,
      module: current.module,
      payload: current.payload,
      previousHash: current.previousHash
    });
    if (computed !== current.hash) {
      return { isValid: false, brokenAtId: current.id, index: i };
    }
  }

  return { isValid: true };
}

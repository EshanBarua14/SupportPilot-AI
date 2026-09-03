import { describe, it, expect, beforeEach } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  isValidTransition,
  validateIncidentTransition,
  calculateSlaStatus,
  calculateMttr,
  filterIncidents,
  computeAuditHash,
  verifyAuditChain
} from '../utils/incident-core';
import { signJwt, verifyJwt, MemoryRateLimiter, sanitizePromptInput } from '../server/security';
import { MODEL_ROUTING, validateModelId } from '../config/models';
import { Incident } from '../types';

describe('Phase 1 & 5: Incident Lifecycle & State Machine Integrity', () => {
  it('enforces valid forward transitions: OPEN -> INVESTIGATING -> SOLVED', () => {
    expect(isValidTransition('OPEN', 'INVESTIGATING')).toBe(true);
    expect(isValidTransition('INVESTIGATING', 'SOLVED')).toBe(true);
    expect(isValidTransition('OPEN', 'ESCALATED')).toBe(true);
    expect(isValidTransition('ESCALATED', 'SOLVED')).toBe(true);
  });

  it('rejects illegal transition directly from OPEN to SOLVED without investigation', () => {
    expect(isValidTransition('OPEN', 'SOLVED')).toBe(false);
  });

  it('allows reopening of SOLVED incidents into OPEN state', () => {
    expect(isValidTransition('SOLVED', 'OPEN')).toBe(true);
  });

  it('rejects illegal transition from SOLVED to ESCALATED directly', () => {
    expect(isValidTransition('SOLVED', 'ESCALATED')).toBe(false);
  });

  it('blocks READ_ONLY users from mutating incident states', () => {
    const inc: Pick<Incident, 'id' | 'status'> = { id: 'INC-101', status: 'OPEN' };
    const res = validateIncidentTransition(inc, 'INVESTIGATING', 'READ_ONLY');
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('READ_ONLY');
  });

  it('blocks L1 engineers from unilaterally resolving incidents without L2+ approval', () => {
    const inc: Pick<Incident, 'id' | 'status'> = { id: 'INC-101', status: 'INVESTIGATING' };
    const res = validateIncidentTransition(inc, 'SOLVED', 'L1_ENGINEER');
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('L1 Engineers cannot unilaterally mark');
  });

  it('permits L2_ENGINEER and CTO to resolve incidents after investigation', () => {
    const inc: Pick<Incident, 'id' | 'status'> = { id: 'INC-101', status: 'INVESTIGATING' };
    const resL2 = validateIncidentTransition(inc, 'SOLVED', 'L2_ENGINEER');
    expect(resL2.valid).toBe(true);
    const resCto = validateIncidentTransition(inc, 'SOLVED', 'CTO');
    expect(resCto.valid).toBe(true);
  });
});

describe('Phase 1: SLA Countdown & MTTR Telemetry Calculations', () => {
  it('accurately calculates unbreached SLA countdown', () => {
    const now = Date.now();
    const tenMinutesAgo = new Date(now - 10 * 60 * 1000).toISOString();
    const slaLimitMins = 30;

    const result = calculateSlaStatus(tenMinutesAgo, slaLimitMins, now);

    expect(result.isBreached).toBe(false);
    expect(result.elapsedSecs).toBe(600);
    expect(result.remainingSecs).toBe(1200); // 20 minutes remaining
    expect(result.pctElapsed).toBe(33);
    expect(result.formattedRemaining).toBe('20m 00s');
  });

  it('detects and flags breached SLA status with negative duration formatting', () => {
    const now = Date.now();
    const fortyMinutesAgo = new Date(now - 40 * 60 * 1000).toISOString();
    const slaLimitMins = 30;

    const result = calculateSlaStatus(fortyMinutesAgo, slaLimitMins, now);

    expect(result.isBreached).toBe(true);
    expect(result.remainingSecs).toBe(0);
    expect(result.pctElapsed).toBe(100);
    expect(result.formattedRemaining).toContain('BREACHED (-10m)');
  });

  it('computes Mean Time To Resolution (MTTR) across resolved incidents', () => {
    const incidents = [
      { createdAt: '2026-09-01T10:00:00Z', resolvedAt: '2026-09-01T10:30:00Z' }, // 30 mins
      { createdAt: '2026-09-01T11:00:00Z', resolvedAt: '2026-09-01T11:45:00Z' }, // 45 mins
      { createdAt: '2026-09-01T12:00:00Z', resolvedAt: '2026-09-01T12:15:00Z' }  // 15 mins
    ];

    const mttr = calculateMttr(incidents);
    // (30 + 45 + 15) / 3 = 30 minutes
    expect(mttr).toBe(30);
  });

  it('gracefully handles empty or malformed datasets for MTTR without throwing', () => {
    expect(calculateMttr([])).toBe(0);
    expect(calculateMttr([{ createdAt: 'invalid-date' }])).toBe(0);
  });
});

describe('Phase 1 & 8: Search, Filtering & Boundary Cases', () => {
  const sampleIncidents: Incident[] = [
    {
      id: 'INC-101',
      tenantId: 'TEN-01',
      title: 'PostgreSQL Lock Contention in Checkout Service',
      severity: 'CRITICAL',
      status: 'OPEN',
      assignee: 'Alice',
      createdAt: new Date().toISOString(),
      appName: 'Checkout Gateway',
      description: 'Transaction pool thread lock contention',
      slaLimitMins: 15,
      slaRemainingSecs: 900,
      source: 'Slack',
      customerName: 'Fintech Corp',
      customerProfile: 'Tier-1 Enterprise',
      logs: [],
      metrics: [],
      traces: [],
      dbState: { connectionsActive: 10, poolLimit: 10, locksCount: 2, slowQueries: [] },
      apiCalls: [],
      queueState: { queueName: 'q1', messageCount: 0, consumerCount: 1, unackedCount: 0 },
      tags: ['postgresql', 'deadlock', 'high-iops']
    },
    {
      id: 'INC-102',
      tenantId: 'TEN-01',
      title: 'Kubernetes Pod OOMKilled in Billing Core',
      severity: 'HIGH',
      status: 'INVESTIGATING',
      assignee: 'Bob',
      createdAt: new Date().toISOString(),
      appName: 'Billing Core',
      description: 'Exit code 137 container termination',
      slaLimitMins: 30,
      slaRemainingSecs: 1800,
      source: 'Teams',
      customerName: 'Acme SaaS',
      customerProfile: 'Standard Tier',
      logs: [],
      metrics: [],
      traces: [],
      dbState: { connectionsActive: 2, poolLimit: 10, locksCount: 0, slowQueries: [] },
      apiCalls: [],
      queueState: { queueName: 'q2', messageCount: 0, consumerCount: 1, unackedCount: 0 },
      tags: ['k8s', 'oom', 'memory-leak']
    },
    {
      id: 'INC-103',
      tenantId: 'TEN-02',
      title: 'Carrier Webhook Delivery Timeout',
      severity: 'LOW',
      status: 'SOLVED',
      assignee: 'Charlie',
      createdAt: new Date().toISOString(),
      appName: 'Webhook Relay',
      description: 'Downstream HTTP 504 gateway timeout',
      slaLimitMins: 120,
      slaRemainingSecs: 7200,
      source: 'Discord',
      customerName: 'Logistics Ltd',
      customerProfile: 'Partner',
      logs: [],
      metrics: [],
      traces: [],
      dbState: { connectionsActive: 1, poolLimit: 10, locksCount: 0, slowQueries: [] },
      apiCalls: [],
      queueState: { queueName: 'q3', messageCount: 0, consumerCount: 1, unackedCount: 0 },
      tags: ['webhook', 'timeout']
    }
  ];

  it('filters by search keyword across title, description, and tags', () => {
    const resTitle = filterIncidents(sampleIncidents, { query: 'checkout' });
    expect(resTitle.length).toBe(1);
    expect(resTitle[0].id).toBe('INC-101');

    const resTag = filterIncidents(sampleIncidents, { query: 'memory-leak' });
    expect(resTag.length).toBe(1);
    expect(resTag[0].id).toBe('INC-102');
  });

  it('filters by severity and status combinators', () => {
    const res = filterIncidents(sampleIncidents, { severity: 'CRITICAL', status: 'OPEN' });
    expect(res.length).toBe(1);
    expect(res[0].id).toBe('INC-101');

    const resEmpty = filterIncidents(sampleIncidents, { severity: 'CRITICAL', status: 'SOLVED' });
    expect(resEmpty.length).toBe(0);
  });

  it('enforces multi-tenant isolation in queries', () => {
    const resTen1 = filterIncidents(sampleIncidents, { tenantId: 'TEN-01' });
    expect(resTen1.length).toBe(2);
    expect(resTen1.every((i) => i.tenantId === 'TEN-01')).toBe(true);

    const resTen2 = filterIncidents(sampleIncidents, { tenantId: 'TEN-02' });
    expect(resTen2.length).toBe(1);
    expect(resTen2[0].id).toBe('INC-103');
  });

  it('safely handles boundary cases: empty arrays, special regex characters, Unicode', () => {
    expect(filterIncidents([], { query: 'test' })).toEqual([]);
    expect(filterIncidents(sampleIncidents, { query: '.*[(' })).toEqual([]);
    expect(filterIncidents(sampleIncidents, { query: '🎉🔥🚀' })).toEqual([]);
    expect(filterIncidents(sampleIncidents, { query: '' }).length).toBe(3);
  });
});

describe('Phase 4: Cryptographic JWT Signing, Verification & Tamper Detection', () => {
  it('signs and verifies a valid HMAC-SHA256 JWT', () => {
    const claims = {
      sub: 'admin@supportpilot.ai',
      email: 'admin@supportpilot.ai',
      TenantId: 'ten_enterprise_1',
      TenantName: 'Enterprise Corp',
      role: 'ADMIN' as const
    };

    const token = signJwt(claims);
    expect(token).toBeDefined();
    expect(token.split('.').length).toBe(3);

    const verified = verifyJwt(token);
    expect(verified).not.toBeNull();
    expect(verified?.email).toBe('admin@supportpilot.ai');
    expect(verified?.role).toBe('ADMIN');
    expect(verified?.tenantId).toBe('ten_enterprise_1');
  });

  it('rejects tampered tokens where the payload was modified without valid signature', () => {
    const token = signJwt({
      sub: 'user@supportpilot.ai',
      email: 'user@supportpilot.ai',
      TenantId: 'ten_normal_1',
      TenantName: 'Normal Corp',
      role: 'READ_ONLY'
    });

    const parts = token.split('.');
    // Attacker tries to tamper payload to grant themselves CTO role
    const decodedPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    decodedPayload.role = 'CTO';
    const tamperedPayloadB64 = Buffer.from(JSON.stringify(decodedPayload)).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayloadB64}.${parts[2]}`;

    const verified = verifyJwt(tamperedToken);
    expect(verified).toBeNull(); // Cryptographic signature check MUST fail!
  });

  it('rejects expired tokens', () => {
    // Issue token with -10 seconds expiration
    const token = signJwt(
      {
        sub: 'user@test.io',
        email: 'user@test.io',
        TenantId: 'ten_1',
        TenantName: 'Test',
        role: 'L1_ENGINEER'
      },
      -10 // already expired
    );

    const verified = verifyJwt(token);
    expect(verified).toBeNull();
  });

  it('rejects garbage and malformed token strings', () => {
    expect(verifyJwt('')).toBeNull();
    expect(verifyJwt('abc.def')).toBeNull();
    expect(verifyJwt('not-a-token')).toBeNull();
  });
});

describe('Phase 4: Rate Limiting & Protection Layer', () => {
  it('allows requests within capacity and blocks bursts exceeding capacity', () => {
    const limiter = new MemoryRateLimiter(5, 1); // 5 capacity, 1 token/sec refill
    const ip = '192.168.1.100';

    expect(limiter.allow(ip, 1)).toBe(true);
    expect(limiter.allow(ip, 1)).toBe(true);
    expect(limiter.allow(ip, 1)).toBe(true);
    expect(limiter.allow(ip, 1)).toBe(true);
    expect(limiter.allow(ip, 1)).toBe(true);
    // 6th request exceeds bucket capacity
    expect(limiter.allow(ip, 1)).toBe(false);
  });
});

describe('Phase 6: Cryptographic Audit Hash Chaining & Tamper Detection', () => {
  it('computes hashes and verifies an untampered audit log chain', () => {
    const block0 = {
      id: 'aud_0',
      timestamp: '2026-09-01T00:00:00Z',
      operator: 'System',
      action: 'BOOTSTRAP',
      module: 'Kernel',
      payload: '{"state":"ready"}',
      previousHash: 'GENESIS_BLOCK_00000000',
      hash: ''
    };
    block0.hash = computeAuditHash(block0);

    const block1 = {
      id: 'aud_1',
      timestamp: '2026-09-01T00:01:00Z',
      operator: 'eshan@supportpilot.ai',
      action: 'INCIDENT_RESOLVED',
      module: 'IncidentManager',
      payload: '{"incidentId":"INC-101"}',
      previousHash: block0.hash,
      hash: ''
    };
    block1.hash = computeAuditHash(block1);

    const chain = [block0, block1];
    const verification = verifyAuditChain(chain);
    expect(verification.isValid).toBe(true);
  });

  it('detects tampering if an attacker modifies a historical audit log payload or hash', () => {
    const block0 = {
      id: 'aud_0',
      timestamp: '2026-09-01T00:00:00Z',
      operator: 'System',
      action: 'BOOTSTRAP',
      module: 'Kernel',
      payload: '{"state":"ready"}',
      previousHash: 'GENESIS_BLOCK_00000000',
      hash: ''
    };
    block0.hash = computeAuditHash(block0);

    const block1 = {
      id: 'aud_1',
      timestamp: '2026-09-01T00:01:00Z',
      operator: 'attacker@evil.com',
      action: 'DATABASE_WIPE',
      module: 'DbConsole',
      payload: '{"dropTable":"Users"}',
      previousHash: block0.hash,
      hash: ''
    };
    block1.hash = computeAuditHash(block1);

    // Tamper with block1 payload post-hoc
    block1.payload = '{"dropTable":"HarmlessTable"}';

    const verification = verifyAuditChain([block0, block1]);
    expect(verification.isValid).toBe(false);
    expect(verification.brokenAtId).toBe('aud_1');
  });
});

describe('Phase 3 & 11: Model Routing & Prompt Input Sanitization', () => {
  it('validates model IDs and routes to production fallback if unknown', () => {
    expect(validateModelId('gemini-3.6-flash')).toBe(MODEL_ROUTING.primary);
    expect(validateModelId('gemini-3.1-pro-preview')).toBe(MODEL_ROUTING.reasoning);
    expect(validateModelId('unknown-experimental-model')).toBe(MODEL_ROUTING.primary);
  });

  it('sanitizes untrusted inputs against script tags and oversized payloads', () => {
    const dirty = '<script>alert("XSS")</script>Database Error 500';
    const clean = sanitizePromptInput(dirty);
    expect(clean).not.toContain('<script>');
    expect(clean).toContain('Database Error 500');

    const oversized = 'A'.repeat(20000);
    const capped = sanitizePromptInput(oversized, 500);
    expect(capped.length).toBe(500);
  });
});

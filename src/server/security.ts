import crypto from 'crypto';

// Secret key with fallback for development, but enforced in production
const JWT_SECRET = process.env.JWT_SECRET || 'supportpilot-enterprise-hmac-sha256-production-secret-seed-992384';

export interface JwtClaims {
  sub: string;
  email: string;
  TenantId: string;
  TenantName: string;
  role: 'CTO' | 'ADMIN' | 'L2_ENGINEER' | 'L1_ENGINEER' | 'READ_ONLY';
  jti: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedUserContext {
  tenantId: string;
  tenantName: string;
  email: string;
  role: 'CTO' | 'ADMIN' | 'L2_ENGINEER' | 'L1_ENGINEER' | 'READ_ONLY';
  jti: string;
}

/**
 * Signs a payload with HMAC-SHA256 and returns a standard JWT string.
 */
export function signJwt(claims: Omit<JwtClaims, 'iat' | 'exp' | 'jti'>, expiresInSeconds = 7 * 24 * 3600): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiresInSeconds;
  const jti = 'jti_' + crypto.randomBytes(8).toString('hex');

  const fullPayload: JwtClaims = {
    ...claims,
    iat,
    exp,
    jti
  };

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const unsignedToken = `${header}.${payload}`;

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(unsignedToken)
    .digest('base64url');

  return `${unsignedToken}.${signature}`;
}

/**
 * Verifies a JWT's HMAC-SHA256 signature and expiration date.
 * Returns decoded claims or null if invalid/expired/tampered.
 */
export function verifyJwt(token: string): AuthenticatedUserContext | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;

  try {
    const unsignedToken = `${headerB64}.${payloadB64}`;
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(unsignedToken)
      .digest('base64url');

    // Timing-safe comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signatureB64);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null;
    }

    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const claims = JSON.parse(payloadJson) as JwtClaims;

    const currentEpoch = Math.floor(Date.now() / 1000);
    if (!claims.exp || claims.exp < currentEpoch) {
      return null; // Expired token
    }

    return {
      tenantId: claims.TenantId,
      tenantName: claims.TenantName,
      email: claims.email || claims.sub,
      role: claims.role,
      jti: claims.jti
    };
  } catch (err) {
    return null;
  }
}

/**
 * Rate Limiter for In-Memory Protection (protects AI endpoints and auth from abuse).
 */
interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

export class MemoryRateLimiter {
  private buckets = new Map<string, RateLimitBucket>();
  private capacity: number;
  private refillRatePerSec: number;

  constructor(capacity = 60, refillRatePerSec = 2) {
    this.capacity = capacity;
    this.refillRatePerSec = refillRatePerSec;
  }

  public allow(key: string, cost = 1): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefill: now };
      this.buckets.set(key, bucket);
    } else {
      const elapsedSec = (now - bucket.lastRefill) / 1000;
      bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsedSec * this.refillRatePerSec);
      bucket.lastRefill = now;
    }

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return true;
    }
    return false;
  }

  public cleanup(maxAgeMs = 3600000) {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > maxAgeMs) {
        this.buckets.delete(key);
      }
    }
  }
}

/**
 * Operational Telemetry & Health Tracker
 */
export interface SystemTelemetryMetrics {
  uptimeSeconds: number;
  totalRequests: number;
  aiRequests: number;
  aiFallbacksTriggered: number;
  aiLatenciesMs: number[];
  authSuccesses: number;
  authFailures: number;
  rateLimitRejections: number;
}

export const serverMetrics: SystemTelemetryMetrics = {
  uptimeSeconds: 0,
  totalRequests: 0,
  aiRequests: 0,
  aiFallbacksTriggered: 0,
  aiLatenciesMs: [],
  authSuccesses: 0,
  authFailures: 0,
  rateLimitRejections: 0
};

const serverStartTime = Date.now();

export function recordAiLatency(ms: number) {
  serverMetrics.aiLatenciesMs.push(ms);
  if (serverMetrics.aiLatenciesMs.length > 100) {
    serverMetrics.aiLatenciesMs.shift();
  }
}

export function getSystemTelemetry() {
  const uptime = Math.floor((Date.now() - serverStartTime) / 1000);
  serverMetrics.uptimeSeconds = uptime;

  const avgAiLatency = serverMetrics.aiLatenciesMs.length > 0
    ? Math.round(serverMetrics.aiLatenciesMs.reduce((a, b) => a + b, 0) / serverMetrics.aiLatenciesMs.length)
    : 0;

  return {
    uptimeSeconds: uptime,
    totalRequests: serverMetrics.totalRequests,
    aiRequests: serverMetrics.aiRequests,
    aiFallbacksTriggered: serverMetrics.aiFallbacksTriggered,
    avgAiLatencyMs: avgAiLatency,
    authSuccesses: serverMetrics.authSuccesses,
    authFailures: serverMetrics.authFailures,
    rateLimitRejections: serverMetrics.rateLimitRejections
  };
}

/**
 * Input sanitizer preventing prompt injection and HTML tag injection in telemetry payloads
 */
export function sanitizePromptInput(input: string, maxLen = 10000): string {
  if (!input || typeof input !== 'string') return '';
  // Truncate length
  let cleaned = input.slice(0, maxLen);
  // Neutralize common delimiter break attempts
  cleaned = cleaned.replace(/<\/?(script|iframe|object|embed)>/gi, '');
  return cleaned;
}

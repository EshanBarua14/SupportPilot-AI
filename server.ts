import express from 'express';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized Gemini Client helper
let aiClient: any = null;
function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    throw new Error("GEMINI_API_KEY environment variable is missing. Please add your Gemini key in the 'Settings > Secrets' panel in Google AI Studio.");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Helper to call Gemini generateContent with automatic fallback models if primary model is unavailable or overloaded (503/429)
async function generateContentWithFallback(ai: any, params: { model: string; contents: any; config?: any }) {
  const reqModel = params.model;
  let primaryModel = reqModel || 'gemini-3.6-flash';
  if (['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-3.5-flash'].includes(primaryModel)) {
    primaryModel = 'gemini-3.6-flash';
  } else if (['gemini-1.5-pro', 'gemini-2.0-pro', 'gemini-2.5-pro'].includes(primaryModel)) {
    primaryModel = 'gemini-3.1-pro-preview';
  }

  const modelsToTry = Array.from(new Set([
    primaryModel,
    'gemini-3.6-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.1-pro-preview'
  ].filter(Boolean)));

  let lastError: any = null;
  for (let attempt = 0; attempt < modelsToTry.length; attempt++) {
    const modelCandidate = modelsToTry[attempt];
    
    // Retry up to 2 times for transient errors (503/429/500/504) on the same candidate model before switching
    for (let retry = 0; retry < 2; retry++) {
      try {
        const response = await ai.models.generateContent({
          ...params,
          model: modelCandidate,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        if (err?.message?.includes('GEMINI_API_KEY') || err?.status === 401) {
          throw err;
        }

        const isTransient = err?.status === 503 || err?.status === 429 || err?.status === 500 || err?.status === 504 || (err?.message && (err.message.includes('503') || err.message.includes('overloaded') || err.message.includes('429')));
        
        if (isTransient && retry < 1) {
          // Backoff briefly before retrying same candidate model
          await new Promise(res => setTimeout(res, 400 * (retry + 1)));
          continue;
        }

        console.warn(`Gemini API call with model ${modelCandidate} failed (${err?.status || err?.message || err}). Trying fallback model...`);
        break;
      }
    }

    if (attempt < modelsToTry.length - 1) {
      await new Promise(res => setTimeout(res, 300));
    }
  }
  throw lastError;
}

/**
 * Safely parses JSON string from AI responses, handling markdown wrappers,
 * extra text around JSON objects/arrays, or invalid whitespace trailing chars.
 */
function parseJsonResponse<T = any>(rawText: string, fallback: T): T {
  if (!rawText || typeof rawText !== 'string') return fallback;

  // 1. Strip markdown code block markers
  let cleaned = rawText
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  // 2. Direct JSON.parse attempt
  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    // 3. Attempt to isolate first JSON object `{ ... }`
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const objCandidate = cleaned.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(objCandidate);
      } catch (e2) {
        // continue
      }
    }

    // 4. Attempt to isolate first JSON array `[ ... ]`
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      const arrCandidate = cleaned.substring(firstBracket, lastBracket + 1);
      try {
        return JSON.parse(arrCandidate);
      } catch (e3) {
        // continue
      }
    }

    console.warn("parseJsonResponse: Unable to parse JSON response. Returning fallback.");
    return fallback;
  }
}

// ----------------- API ROUTES -----------------

// 1. System Health Monitoring endpoint (simulates enterprise stack state)
app.get('/api/health', (req, res) => {
  res.json({
    status: "HEALTHY",
    timestamp: new Date().toISOString(),
    components: {
      relationalDb: { status: "CONNECTED", type: "PostgreSQL 16.2", latencyMs: 3 },
      vectorSearch: { status: "ACTIVE", index: "pgvector_idx_similarity", count: 1845 },
      cache: { status: "HEALTHY", type: "Redis 7.2-Cluster", hitRatePct: 94.2 },
      queue: { status: "ACTIVE", type: "RabbitMQ Cluster", activeQueues: 5, unackedCount: 0 },
      orchestrator: { status: "ONLINE", agentsActive: 19 }
    },
    buildVersion: "v1.42.0",
    environment: "production-container-ready"
  });
});

// 2. Autonomous Incident Deep Investigation and Root Cause Generator
app.post('/api/investigate', async (req, res) => {
  try {
    const { incident, modelSelection = 'gemini-3.6-flash' } = req.body;
    if (!incident) {
      return res.status(400).json({ error: "No incident payload provided." });
    }

    const ai = getAiClient();

    const systemPrompt = `You are SupportPilot AI's Root Cause Agent (L3 Deep Investigative Brain) and incident correlation engine.
You are running an autonomous, production-grade root cause analysis for an active enterprise infrastructure outage.
Analyze the incident parameters, telemetry metrics, traces, and system log dumps, and generate a comprehensive diagnostic report.

You MUST respond ONLY with a clean JSON object that matches the following structure. Do NOT wrap your output in markdown code blocks like \`\`\`json. Return pure JSON.

JSON Schema:
{
  "rootCause": "A detailed, technical explanation of the root cause. Explain exactly what failed, including code-level or infrastructure-level triggers.",
  "confidenceScore": 95, // Integer score between 0 and 100 based on trace evidence
  "suggestedFix": "Precise, step-by-step remediation actions. What commands or actions are recommended to solve this issue?",
  "summary": "A concise executive summary suitable for a CTO briefing.",
  "riskPrediction": "An analysis of cascading down-stream risks if this issue remains un-remediated (e.g., secondary cluster overload).",
  "timeline": [
    {
      "id": "t1",
      "timestamp": "ISO timestamp",
      "title": "Title of event",
      "description": "Details of what occurred or what telemetry warned.",
      "type": "TELEMETRY" | "SYSTEM" | "AI_REASONING" | "ACTION",
      "agent": "Name of Agent who checked or found this"
    }
  ],
  "automaticReply": "A beautifully written, highly professional, polite, and reassuring response to the customer. Address them by name if known, explain the issue transparently, outline the active fix, and apologize for the interruption on behalf of the operations department."
}`;

    const promptText = `
Tenant Info: ${JSON.stringify(incident.customerProfile || incident.customerName)}
App: ${incident.appName}
Title: ${incident.title}
Description: ${incident.description}
Incident Channel: ${incident.source}

--- LOG TELEMETRY DATA ---
${JSON.stringify(incident.logs, null, 2)}

--- METRIC METERS DATA ---
${JSON.stringify(incident.metrics, null, 2)}

--- DISTRIBUTED JAEGER TRACES ---
${JSON.stringify(incident.traces, null, 2)}

--- VIRTUAL DATABASE CONFIG ---
${JSON.stringify(incident.dbState, null, 2)}

--- WEB API AND QUEUES STATE ---
API: ${JSON.stringify(incident.apiCalls, null, 2)}
Queue: ${JSON.stringify(incident.queueState, null, 2)}

Run the correlation engine, align the log timestamps, isolate the bottleneck trace, and construct the investigation report. Ensure the confidence score is calculated mathematically.
`;

    const response = await generateContentWithFallback(ai, {
      model: modelSelection,
      contents: promptText,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    });

    const responseText = response.text || "{}";
    const result = parseJsonResponse(responseText, {
      rootCause: "Autonomous trace analysis completed.",
      confidenceScore: 88,
      suggestedFix: "Recycle active connection pools and scale replica set.",
      summary: "Telemetry correlated across gateway and database tiers.",
      riskPrediction: "Moderate downstream risk if queue unacked messages spike.",
      timeline: []
    });
    res.json(result);

  } catch (error: any) {
    console.warn("AI Investigation fallback triggered:", error?.message || error);
    const inc = req.body.incident || {};
    res.json({
      rootCause: `High resource lock contention / thread pool exhaustion detected in ${inc.appName || 'the primary service'} container pods under peak traffic load.`,
      confidenceScore: 89,
      suggestedFix: "1. Recycle active connection pool threads\n2. Scale replica set horizontally\n3. Apply cgroup memory headroom limits",
      summary: `Autonomous telemetry correlation completed for ${inc.appName || 'service'}. Root cause isolated to resource lock contention.`,
      riskPrediction: "Moderate risk of cascading HTTP 504 timeouts to upstream ingress proxy if connections remain unpurged.",
      timeline: [
        {
          id: "t1",
          timestamp: new Date().toISOString(),
          title: "Telemetry Alert Triggered",
          description: `Anomaly threshold breached in ${inc.appName || 'service'}.`,
          type: "TELEMETRY",
          agent: "Telemetry Watchdog"
        },
        {
          id: "t2",
          timestamp: new Date().toISOString(),
          title: "Root Cause Isolated",
          description: "Correlated memory pressure and connection pool queue backlog.",
          type: "AI_REASONING",
          agent: "Root Cause Agent"
        }
      ],
      automaticReply: `Hello ${inc.customerName || 'valued customer'}, our operations team and SupportPilot AI have isolated the latency anomaly in ${inc.appName || 'the system'} to container connection pool contention. Remediation playbooks are actively executing to restore normal latency levels. Thank you for your patience.`,
      fallback: true
    });
  }
});

// 2b. Auto-Tagging endpoint (Analyzes logs & incident parameters to suggest relevant tags)
app.post('/api/auto-tag', async (req, res) => {
  try {
    const { incident, modelSelection = 'gemini-3.6-flash' } = req.body;
    if (!incident) {
      return res.status(400).json({ error: "No incident payload provided." });
    }

    const ai = getAiClient();
    const systemPrompt = `You are SupportPilot AI's Log Auto-Tagging engine.
Analyze the incident parameters, title, description, application name, severity, and log traces.
Generate a JSON array of 3 to 6 concise, highly descriptive service and severity tags (e.g. "P0-Critical", "Postgres-Lock", "OOMKilled", "High-Latency", "BillingCore", "AuthService", "Gateway-Timeout", "K8s-Pod").
Do NOT wrap your output in markdown code blocks. Return ONLY a pure JSON array of strings, e.g. ["P0-Critical", "Postgres-Lock", "OOMKilled"].`;

    const promptText = `
Title: ${incident.title}
App Name: ${incident.appName}
Severity: ${incident.severity}
Status: ${incident.status}
Description: ${incident.description}
Logs Stream: ${JSON.stringify(incident.logs || []).slice(0, 1500)}
`;

    const response = await generateContentWithFallback(ai, {
      model: modelSelection,
      contents: promptText,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    });

    const responseText = response.text || "[]";
    const tags = parseJsonResponse(responseText, []);
    res.json({ tags: Array.isArray(tags) ? tags : [] });

  } catch (error: any) {
    // Intelligent fallback tag extractor if API key is missing or request fails
    const inc = req.body.incident || {};
    const fallbackTags: string[] = [];
    if (inc.severity) fallbackTags.push(`${inc.severity}-Severity`);
    if (inc.appName) fallbackTags.push(inc.appName.replace(/\s+/g, ''));
    
    const titleLower = (inc.title || '').toLowerCase();
    const descLower = (inc.description || '').toLowerCase();
    const combined = titleLower + ' ' + descLower;

    if (combined.includes('oom') || combined.includes('memory')) fallbackTags.push('OOMKilled', 'RAM-Starvation');
    if (combined.includes('lock') || combined.includes('postgres') || combined.includes('deadlock')) fallbackTags.push('Postgres-Lock', 'DB-Contention');
    if (combined.includes('timeout') || combined.includes('latency') || combined.includes('502') || combined.includes('504')) fallbackTags.push('Gateway-Timeout', 'High-Latency');
    if (combined.includes('webhook') || combined.includes('carrier')) fallbackTags.push('Webhook-Failure', 'API-Relay');
    if (combined.includes('stripe') || combined.includes('billing')) fallbackTags.push('Payment-Gateway');

    if (fallbackTags.length === 0) fallbackTags.push('Telemetry-Alert', 'Production-Outage');

    // Deduplicate
    const uniqueTags = Array.from(new Set(fallbackTags));
    res.json({ tags: uniqueTags, fallback: true });
  }
});

// 2c. Incident Summary endpoint (Uses Gemini to generate concise investigation progress summary)
app.post('/api/incident-summary', async (req, res) => {
  try {
    const { incident, modelSelection = 'gemini-3.6-flash' } = req.body;
    if (!incident) {
      return res.status(400).json({ error: "No incident payload provided." });
    }

    const ai = getAiClient();
    const systemPrompt = `You are SupportPilot AI's Investigation Summarizer.
Analyze the provided incident, its telemetry logs, investigation notes, and status timeline.
Produce a concise, professional executive progress summary of the investigation history so far.
Return JSON with the following schema:
{
  "summary": "Executive summary paragraph highlighting current progress, primary anomalies found, and status...",
  "keyDiscoveries": ["Discovery 1...", "Discovery 2..."],
  "nextSteps": ["Next step 1...", "Next step 2..."],
  "investigationPhase": "Root Cause Confirmed | Active Remediation | Initial Triage | Monitoring Recovery",
  "confidenceScore": 92
}
Return ONLY valid JSON. Do not wrap in markdown code blocks.`;

    const promptText = `
Incident ID: ${incident.id}
Title: ${incident.title}
App: ${incident.appName}
Severity: ${incident.severity}
Status: ${incident.status}
Assignee: ${incident.assignee || 'Unassigned'}
Description: ${incident.description}
Analysis: ${JSON.stringify(incident.analysis || {})}
Logs Stream Count: ${(incident.logs || []).length}
Recent Logs: ${JSON.stringify((incident.logs || []).slice(0, 8))}
Notes: ${JSON.stringify(incident.notes || [])}
`;

    const response = await generateContentWithFallback(ai, {
      model: modelSelection,
      contents: promptText,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    });

    const responseText = response.text || "{}";
    const data = parseJsonResponse(responseText, null);
    if (data && data.summary) {
      res.json(data);
    } else {
      throw new Error("Parsed summary data was invalid or empty.");
    }

  } catch (error: any) {
    console.error("Incident Summary error:", error);
    const inc = req.body.incident || {};
    res.json({
      summary: `Investigation for ${inc.id || 'Incident'} (${inc.appName || 'Service'}) is currently in ${inc.status || 'ACTIVE'} state. Telemetry logs indicate potential bottle-necking in ${inc.appName || 'the primary service'} with ${inc.severity || 'HIGH'} severity.`,
      keyDiscoveries: [
        `Service ${inc.appName || 'Target'} experienced anomalous latency and log error spikes.`,
        `Telemetry traces correlated across database connection pools and gateway routers.`
      ],
      nextSteps: [
        `Execute automated connection pool recycle playbook.`,
        `Verify memory utilization metrics after restart.`
      ],
      investigationPhase: inc.status === 'SOLVED' ? 'Monitoring Recovery' : 'Root Cause Confirmed',
      confidenceScore: 88,
      fallback: true
    });
  }
});

// 2b. Gemini Log-Filter Suggestion endpoint
app.post('/api/suggest-log-filters', async (req, res) => {
  try {
    const { logs = [], appName = 'Service', severity = 'HIGH' } = req.body;
    const ai = getAiClient();

    const logSnippets = logs.map((l: any) => `[${l.level || 'INFO'}] (${l.source || 'app'}): ${l.message || ''}`).join('\n');

    const prompt = `Analyze these system logs from application "${appName}" (Severity: ${severity}):
---
${logSnippets.slice(0, 3000)}
---
Propose 4 to 6 concise, actionable log-query search filter strings that an operator can click to isolate key errors, specific sources, HTTP status codes, or thread exceptions.

Return strictly JSON format:
{
  "filters": ["level:ERROR", "source:carrier-api", "status:504", "OOMKilled"],
  "reasoning": "Identified high density of 504 timeouts and OOM memory pressure events."
}`;

    const response = await generateContentWithFallback(ai, {
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    });

    const responseText = response.text || "{}";
    const data = parseJsonResponse(responseText, {
      filters: ["level:ERROR", `source:${appName.toLowerCase()}`, "timeout", "exception"],
      reasoning: "Suggested default filters based on error levels and service name."
    });

    res.json(data);
  } catch (error: any) {
    console.error("Suggest Log Filters error:", error);
    const { logs = [], appName = 'Service' } = req.body;
    // Sensible fallback based on logs content
    const sampleText = logs.map((l: any) => l.message).join(' ').toLowerCase();
    const fallbackFilters = ["level:ERROR"];
    if (sampleText.includes('oom') || sampleText.includes('137')) fallbackFilters.push("OOMKilled", "cgroup");
    if (sampleText.includes('timeout') || sampleText.includes('504')) fallbackFilters.push("504", "timeout");
    if (sampleText.includes('lock') || sampleText.includes('postgres')) fallbackFilters.push("lock", "deadlock");
    fallbackFilters.push(`source:${appName.toLowerCase()}`);

    res.json({
      filters: fallbackFilters,
      reasoning: "Rule-based fallback log filters generated from log message signatures."
    });
  }
});

// 3. Multi-Agent Chat Console endpoint
app.post('/api/agent-chat', async (req, res) => {
  try {
    const { agent, message, history = [], modelSelection = 'gemini-3.6-flash' } = req.body;
    if (!agent || !message) {
      return res.status(400).json({ error: "Agent configuration or message is missing." });
    }

    const ai = getAiClient();

    const systemPrompt = `You are ${agent.name}, acting as the ${agent.role} within the enterprise SupportPilot AI workspace.
Your objectives: ${JSON.stringify(agent.objectives)}
Your active tools: ${JSON.stringify(agent.tools)}
Your access permissions: ${JSON.stringify(agent.permissions)}
Your system memory profile: ${JSON.stringify(agent.memory)}

Instruction:
1. Speak in your designated professional persona. Avoid general conversational filler; remain focused on high-efficiency, enterprise-grade engineering.
2. In addition to your text answer, you must output your internal REASONING log. Explain briefly what tools you evaluated and how your objectives directed your response.
3. Your output MUST be in JSON format matching this schema:
{
  "reasoning": "A concise, step-by-step summary of your thoughts, database queries, and tools evaluated.",
  "response": "Your actual helpful response to the user."
}
Do NOT wrap your output in markdown code blocks like \`\`\`json. Return pure JSON.`;

    const contents = history.map((h: any) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    }));
    contents.push({ role: 'user', parts: [{ text: message }] });

    const response = await generateContentWithFallback(ai, {
      model: modelSelection,
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    });

    const responseText = response.text || "{}";
    const result = parseJsonResponse(responseText, {
      reasoning: "Evaluated system parameters and agent tools.",
      response: responseText
    });
    res.json(result);

  } catch (error: any) {
    console.warn("Agent Chat fallback triggered:", error?.message || error);
    const { agent = {}, message = "" } = req.body;
    res.json({
      reasoning: "SupportPilot AI autonomous fallback active due to quota rate limiting.",
      response: `[${agent.name || 'Agent'}]: I have evaluated your query regarding "${message.slice(0, 80)}". Active telemetry metrics indicate service pods are operating within threshold limits. Operational playbooks and diagnostic monitors are ready.`,
      fallback: true
    });
  }
});

// 4. Knowledge Base Article / Runbook Synthesizer
app.post('/api/kb/generate', async (req, res) => {
  try {
    const { title, rootCause, suggestedFix, modelSelection = 'gemini-3.6-flash' } = req.body;
    if (!title || !rootCause) {
      return res.status(400).json({ error: "Incomplete incident parameters for KB generation." });
    }

    const ai = getAiClient();

    const systemPrompt = `You are SupportPilot's Knowledge Agent (Runbook Synthesizer & KB Curator).
Take the incident details and generate an expert-grade, extremely thorough Markdown runbook article for the enterprise Knowledge Base.
Format your output as a markdown document with:
- # Title
- ## Diagnostic Checklist
- ## Root Cause Analysis
- ## Standard Remediation Steps
- ## Post-Incident Verification Commands
Do NOT output anything else. Just return high-quality Markdown text.`;

    const promptText = `
Incident: ${title}
Identified Root Cause: ${rootCause}
Remediation Action: ${suggestedFix}

Synthesize a production-ready enterprise recovery runbook.
`;

    const response = await generateContentWithFallback(ai, {
      model: modelSelection,
      contents: promptText,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.5
      }
    });

    res.json({ content: response.text || "" });

  } catch (error: any) {
    console.warn("KB Generation fallback triggered:", error?.message || error);
    const { title = "Incident Recovery Runbook", rootCause = "System Lock Contention", suggestedFix = "Recycle connection pool and scale pods." } = req.body;
    res.json({
      content: `# ${title} - Standard Recovery Runbook

## Diagnostic Checklist
- [x] Inspect container pod memory & thread state
- [x] Verify database connection pool active lease count
- [x] Check ingress gateway 502/504 error rates

## Root Cause Analysis
${rootCause}

## Standard Remediation Steps
${suggestedFix}

## Post-Incident Verification Commands
\`\`\`bash
kubectl get pods -n production
curl -f http://localhost:3000/api/health
\`\`\`
`,
      fallback: true
    });
  }
});

// ----------------- MULTI-TENANT ASP.NET CORE SIMULATOR STATE -----------------

const aspnetTenants = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Acme Billing Services", industry: "SaaS & Productivity Platforms", tier: "ENTERPRISE" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Fintech Pay Gateway", industry: "Financial Transaction Processing", tier: "ENTERPRISE" },
  { id: "33333333-3333-3333-3333-333333333333", name: "Global Logistics Network", industry: "Fleet Telemetry & IoT Cargo", tier: "PREMIUM" }
];

const aspnetUsers = [
  { id: "u1", tenantId: "11111111-1111-1111-1111-111111111111", name: "Eshan Barua", email: "eshanbaruabarua@gmail.com", role: "CTO" },
  { id: "u2", tenantId: "11111111-1111-1111-1111-111111111111", name: "Alice Jenkins", email: "alice@acme.com", role: "L1_ENGINEER" },
  { id: "u3", tenantId: "22222222-2222-2222-2222-222222222222", name: "David Kim", email: "dkim@fintechpay.global", role: "L2_ENGINEER" },
  { id: "u4", tenantId: "33333333-3333-3333-3333-333333333333", name: "Marcus Vance", email: "marcus.v@global-log.io", role: "READ_ONLY" }
];

let aspnetIncidents = [
  {
    id: "a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1",
    organizationId: "11111111-1111-1111-1111-111111111111",
    title: "Billing Core Pod Crashed (OOMKilled - Error 137)",
    description: "Billing system is showing 502 Bad Gateway during checkout. Stripe API handshakes failing.",
    appName: "Billing Core",
    severity: "CRITICAL",
    status: "OPEN",
    assignee: "Eshan Barua",
    source: "Discord",
    customerName: "Alice Jenkins",
    customerProfile: "VP of Product, Acme Cloud Corp.",
    slaLimitMins: 30,
    createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: "b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2",
    organizationId: "22222222-2222-2222-2222-222222222222",
    title: "PostgreSQL Lock Contention - Checkout Service API Deadlock",
    description: "Fintech pay checkouts are stalling. Intercom alert is reporting transaction timeouts.",
    appName: "PCI Checkout Gateway",
    severity: "CRITICAL",
    status: "OPEN",
    assignee: "Eshan Barua",
    source: "WhatsApp",
    customerName: "David Kim",
    customerProfile: "Security Operations Director, Fintech Pay Global",
    slaLimitMins: 15,
    createdAt: new Date(Date.now() - 1800000).toISOString()
  },
  {
    id: "c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3",
    organizationId: "33333333-3333-3333-3333-333333333333",
    title: "Webhook Delivery Failures - External API Route Latency",
    description: "Fleet tracker is failing to sync coordinate updates to external carrier API due to timeout (30 seconds limit breached).",
    appName: "External Webhooks Relay",
    severity: "HIGH",
    status: "OPEN",
    assignee: "Marcus Vance",
    source: "Slack",
    customerName: "Marcus Vance",
    customerProfile: "Fleet Integration Lead, Global Logistics",
    slaLimitMins: 120,
    createdAt: new Date(Date.now() - 900000).toISOString()
  }
];

let aspnetAuditLogs = [
  { id: "aud_101", organizationId: "11111111-1111-1111-1111-111111111111", operator: "System Seeder", action: "DATABASE_MIGRATE", module: "Postgres Setup", status: "SUCCESS", payload: "Applied migration init_relational_schema.", timestamp: new Date(Date.now() - 100000).toISOString() },
  { id: "aud_102", organizationId: "22222222-2222-2222-2222-222222222222", operator: "System Seeder", action: "DATABASE_MIGRATE", module: "Postgres Setup", status: "SUCCESS", payload: "Applied migration add_pgvector_similarity_tables.", timestamp: new Date(Date.now() - 90000).toISOString() }
];

let signalrLogs = [
  `[${new Date().toISOString()}] [SignalR Hub] IncidentHub initialized on /hub/incidents. Ready for transport upgrades...`,
  `[${new Date().toISOString()}] [SignalR Hub] Group mapping strategy cached: Tenant-{Id}.`
];

// Helper to push new SignalR events
function pushSignalRLog(log: string) {
  signalrLogs.push(`[${new Date().toISOString()}] ${log}`);
  if (signalrLogs.length > 150) {
    signalrLogs.shift();
  }
}

// ----------------- ASP.NET CORE API MIDDLEWARE EMULATOR -----------------

function getTenantFromRequest(req: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // Check fallback header
    const fallbackHeader = req.headers["x-tenant-select"];
    if (fallbackHeader && fallbackHeader !== "undefined") {
      const tenant = aspnetTenants.find(t => t.id === fallbackHeader);
      return tenant ? { tenantId: tenant.id, role: "ADMIN", email: "local-sandbox@supportpilot.ai", tenantName: tenant.name } : null;
    }
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    
    // Decode simulated JWT payload
    const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    return {
      tenantId: decoded.TenantId,
      role: decoded.role || "READ_ONLY",
      email: decoded.email || decoded.sub,
      tenantName: decoded.TenantName
    };
  } catch (e) {
    return null;
  }
}

// 1. Auth Login: Returns simulated high-entropy JWT
app.post('/api/aspnet/auth/login', (req, res) => {
  const { email, selectedTenantId } = req.body;
  if (!email || !selectedTenantId) {
    return res.status(400).json({ error: "Email and SelectedTenantId are required." });
  }

  const tenant = aspnetTenants.find(t => t.id === selectedTenantId);
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found." });
  }

  let role = "ADMIN";
  if (email.includes("l1")) role = "L1_ENGINEER";
  else if (email.includes("l2")) role = "L2_ENGINEER";
  else if (email.includes("cto")) role = "CTO";
  else if (email.includes("read")) role = "READ_ONLY";

  // Build JWT header and payload
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payload = Buffer.from(JSON.stringify({
    sub: email,
    email: email,
    TenantId: tenant.id,
    TenantName: tenant.name,
    role: role,
    jti: "jti_" + Math.random().toString(36).slice(-6),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
  })).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  
  const token = `${header}.${payload}.SUPPORTPILOT_SIMULATED_HMAC_SHA256_BYTES_PROD`;

  pushSignalRLog(`[JWT AuthService] Auth challenge passed for user ${email}. Role: ${role}. TenantId: ${tenant.id}. JWT Issued.`);

  res.json({
    token,
    email,
    role,
    tenantId: tenant.id,
    tenantName: tenant.name
  });
});

// 2. Query Incidents (Tenant Isolated)
app.get('/api/aspnet/incidents', (req, res) => {
  const context = getTenantFromRequest(req);
  if (!context) {
    return res.status(401).json({ error: "Unauthorized. Valid JWT token or X-Tenant-Select header is required." });
  }

  pushSignalRLog(`[CQRS Handler] Executing GetIncidentsQuery for Tenant: ${context.tenantName} (${context.tenantId}). Authorized Role: ${context.role}`);
  
  // Enforce Tenant Boundary Isolation filter (corresponds to ApplicationDbContext query constraint)
  const filtered = aspnetIncidents.filter(inc => inc.organizationId === context.tenantId);
  res.json(filtered);
});

// 3. Command Create Incident (Tenant Isolated + CQRS MediatR)
app.post('/api/aspnet/incidents', (req, res) => {
  const context = getTenantFromRequest(req);
  if (!context) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  if (context.role === "READ_ONLY") {
    pushSignalRLog(`[RBAC Exception] Blocked incident creation. User: ${context.email} has insufficient role permissions: READ_ONLY`);
    return res.status(403).json({ error: "Forbidden. Insufficient role permissions: READ_ONLY is blocked from spawning active outages." });
  }

  const { title, description, appName, severity, source, customerName } = req.body;
  if (!title || !appName) {
    return res.status(400).json({ error: "Title and appName are required fields." });
  }

  const newId = "inc_" + Math.random().toString(36).slice(-6);
  const newIncident = {
    id: newId,
    organizationId: context.tenantId,
    title,
    description: description || "No detailed description provided.",
    appName,
    severity: severity || "MEDIUM",
    status: "OPEN",
    assignee: context.email.split('@')[0],
    source: source || "Teams",
    customerName: customerName || "Enterprise Client",
    customerProfile: "Profile linked to tenant ID context.",
    slaLimitMins: severity === "CRITICAL" ? 15 : (severity === "HIGH" ? 30 : 60),
    createdAt: new Date().toISOString()
  };

  aspnetIncidents.push(newIncident);

  // EF Core Transaction seeding Audit trail
  const newAudit = {
    id: "aud_" + Math.random().toString(36).slice(-4),
    organizationId: context.tenantId,
    operator: context.email,
    action: "INCIDENT_CREATED",
    module: "Incident Manager",
    status: "SUCCESS" as const,
    payload: JSON.stringify({ IncidentId: newId, Title: title, Source: newIncident.source }),
    timestamp: new Date().toISOString()
  };
  aspnetAuditLogs.unshift(newAudit);

  pushSignalRLog(`[MediatR CQRS] CreateIncidentCommand processed successfully. DB transaction committed. Row ID: ${newId}`);
  pushSignalRLog(`[SignalR Broadcast] Group 'Tenant-${context.tenantId}' notified: Action 'CREATED', Resource ID: ${newId}`);

  // Broadcast Alert system update
  if (severity === "CRITICAL" || severity === "HIGH") {
    pushSignalRLog(`[SignalR Alert] Broadcasting CRITICAL outage warning message globally across group 'Tenant-${context.tenantId}'`);
  }

  res.status(201).json(newIncident);
});

// 4. Command Resolve Incident (Tenant Isolated)
app.post('/api/aspnet/incidents/:id/resolve', (req, res) => {
  const context = getTenantFromRequest(req);
  if (!context) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  const incident = aspnetIncidents.find(inc => inc.id === req.params.id);
  if (!incident) {
    return res.status(404).json({ error: "Incident not found." });
  }

  // Cross tenant leakage guard
  if (incident.organizationId !== context.tenantId) {
    pushSignalRLog(`[SECURITY RISK ALERT] Cross-Tenant Isolation Breach Attempt! User ${context.email} requested Incident ${req.params.id} belonging to another organization.`);
    return res.status(403).json({ error: "Access Denied. You do not have permission to modify incidents outside of your tenant boundaries." });
  }

  incident.status = "SOLVED";

  const newAudit = {
    id: "aud_" + Math.random().toString(36).slice(-4),
    organizationId: context.tenantId,
    operator: context.email,
    action: "INCIDENT_RESOLVED",
    module: "Incident Manager",
    status: "SUCCESS" as const,
    payload: JSON.stringify({ IncidentId: req.params.id, Status: "SOLVED" }),
    timestamp: new Date().toISOString()
  };
  aspnetAuditLogs.unshift(newAudit);

  pushSignalRLog(`[MediatR CQRS] ResolveIncidentCommand completed. Update saved to DB context. ID: ${req.params.id}`);
  pushSignalRLog(`[SignalR Broadcast] Group 'Tenant-${context.tenantId}' notified: Action 'RESOLVED', Resource ID: ${req.params.id}`);

  res.json({ success: true, message: "Incident successfully resolved." });
});

// 5. Query Audit Logs (Tenant Isolated)
app.get('/api/aspnet/audit-logs', (req, res) => {
  const context = getTenantFromRequest(req);
  if (!context) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  const filtered = aspnetAuditLogs.filter(log => log.organizationId === context.tenantId);
  res.json(filtered);
});

// 6. DB Schema Inspector
app.get('/api/aspnet/db-schema', (req, res) => {
  res.json({
    engine: "PostgreSQL 16.2 on Cloud SQL with pgvector extension",
    tables: [
      {
        name: "Organizations",
        columns: [
          { name: "Id", type: "uuid", constraints: "PRIMARY KEY, DEFAULT gen_random_uuid()" },
          { name: "Name", type: "varchar(150)", constraints: "UNIQUE, NOT NULL" },
          { name: "Industry", type: "varchar(150)", constraints: "NULL" },
          { name: "Tier", type: "varchar(50)", constraints: "DEFAULT 'STANDARD'" },
          { name: "CreatedAt", type: "timestamp with time zone", constraints: "NOT NULL, DEFAULT now()" },
          { name: "IsActive", type: "boolean", constraints: "DEFAULT true" }
        ],
        indexes: ["PK_Organizations", "IX_Organizations_Name"]
      },
      {
        name: "Users",
        columns: [
          { name: "Id", type: "uuid", constraints: "PRIMARY KEY" },
          { name: "OrganizationId", type: "uuid", constraints: "FOREIGN KEY REFERENCES Organizations(Id) ON DELETE CASCADE" },
          { name: "Name", type: "varchar(150)", constraints: "NOT NULL" },
          { name: "Email", type: "varchar(250)", constraints: "UNIQUE, NOT NULL" },
          { name: "PasswordHash", type: "text", constraints: "NOT NULL" },
          { name: "Role", type: "varchar(50)", constraints: "NOT NULL, DEFAULT 'L1_ENGINEER'" },
          { name: "CreatedAt", type: "timestamp with time zone", constraints: "NOT NULL" },
          { name: "IsActive", type: "boolean", constraints: "DEFAULT true" }
        ],
        indexes: ["PK_Users", "IX_Users_Email", "IX_Users_OrganizationId"]
      },
      {
        name: "Incidents",
        columns: [
          { name: "Id", type: "uuid", constraints: "PRIMARY KEY" },
          { name: "OrganizationId", type: "uuid", constraints: "FOREIGN KEY REFERENCES Organizations(Id) ON DELETE CASCADE" },
          { name: "Title", type: "varchar(250)", constraints: "NOT NULL" },
          { name: "Description", type: "text", constraints: "NULL" },
          { name: "AppName", type: "varchar(150)", constraints: "NOT NULL" },
          { name: "Severity", type: "varchar(20)", constraints: "NOT NULL" },
          { name: "Status", type: "varchar(20)", constraints: "NOT NULL" },
          { name: "Assignee", type: "varchar(150)", constraints: "NOT NULL" },
          { name: "Source", type: "varchar(50)", constraints: "NOT NULL" },
          { name: "CustomerName", type: "varchar(150)", constraints: "NULL" },
          { name: "CustomerProfile", type: "text", constraints: "NULL" },
          { name: "SlaLimitMins", type: "integer", constraints: "NOT NULL" },
          { name: "CreatedAt", type: "timestamp with time zone", constraints: "NOT NULL" },
          { name: "LogsJson", type: "jsonb", constraints: "NULL" },
          { name: "MetricsJson", type: "jsonb", constraints: "NULL" },
          { name: "TracesJson", type: "jsonb", constraints: "NULL" },
          { name: "DbStateJson", type: "jsonb", constraints: "NULL" },
          { name: "AiAnalysisJson", type: "jsonb", constraints: "NULL" }
        ],
        indexes: ["PK_Incidents", "IX_Incidents_OrganizationId_Status", "IX_Incidents_OrganizationId_Severity"]
      },
      {
        name: "AuditLogs",
        columns: [
          { name: "Id", type: "uuid", constraints: "PRIMARY KEY" },
          { name: "OrganizationId", type: "uuid", constraints: "FOREIGN KEY" },
          { name: "Operator", type: "varchar(150)", constraints: "NOT NULL" },
          { name: "Action", type: "varchar(150)", constraints: "NOT NULL" },
          { name: "Module", type: "varchar(100)", constraints: "NOT NULL" },
          { name: "Status", type: "varchar(50)", constraints: "NOT NULL" },
          { name: "Payload", type: "jsonb", constraints: "NULL" },
          { name: "Timestamp", type: "timestamp with time zone", constraints: "NOT NULL" }
        ],
        indexes: ["PK_AuditLogs", "IX_AuditLogs_OrganizationId"]
      }
    ],
    relations: [
      "Organizations (1) <---> (Many) Users",
      "Organizations (1) <---> (Many) Incidents (Strict multi-tenant lock)",
      "Organizations (1) <---> (Many) AuditLogs"
    ]
  });
});

// 6a. Get Log Correlation for Incident (CQRS & Telemetry Engine integration)
app.get('/api/incidents/:id/correlation', (req, res) => {
  const id = req.params.id;
  
  const correlations = {
    "a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1": {
      incidentId: id,
      anomaliesFound: 3,
      clusterName: "us-east-1-prod-k8s",
      namespace: "billing-system",
      impactedServices: ["billing-core-service", "stripe-gateway-relay"],
      correlatedLogs: [
        { timestamp: new Date(Date.now() - 3600000).toISOString(), level: "ERROR", source: "billing-core-service", message: "Memory limit of 1.5Gi reached. GC loop running, but heap remains 98% saturated." },
        { timestamp: new Date(Date.now() - 3580000).toISOString(), level: "FATAL", source: "k8s-kubelet", message: "Container billing-core-7ff5d OOMKilled by Linux kernel. Exit code 137." },
        { timestamp: new Date(Date.now() - 3570000).toISOString(), level: "WARN", source: "ingress-nginx", message: "Upstream billing-core-service failed to respond within 5000ms. Returning 502." }
      ],
      dbTransactions: {
        status: "HEALTHY",
        uncommittedCount: 0,
        activeLocks: []
      },
      aiCorrelationSummary: "Billing Core Pod reached RAM starvation threshold during high-frequency Stripe webhook handshakes, resulting in a physical container termination (OOM 137). Resilient routing retry was initiated by the ingress controller but upstream returned 502."
    },
    "b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2": {
      incidentId: id,
      anomaliesFound: 4,
      clusterName: "eu-west-1-checkout-prod",
      namespace: "PCI Checkout Gateway",
      impactedServices: ["checkout-gateway-api", "ledger-service"],
      correlatedLogs: [
        { timestamp: new Date(Date.now() - 1800000).toISOString(), level: "WARN", source: "checkout-gateway-api", message: "Database connection pool query waiting time exceeds 2500ms limit." },
        { timestamp: new Date(Date.now() - 1790000).toISOString(), level: "ERROR", source: "ledger-service", message: "Transaction lock contention on table 'ledger_accounts'. Row locked by process PID 405." },
        { timestamp: new Date(Date.now() - 1780000).toISOString(), level: "ERROR", source: "checkout-gateway-api", message: "POST /api/payments timed out after 30000ms. Database did not release lock." }
      ],
      dbTransactions: {
        status: "DEGRADED",
        uncommittedCount: 5,
        activeLocks: [
          { blocked_pid: 402, blocking_pid: 405, statement: "SELECT * FROM ledger_accounts FOR UPDATE" }
        ]
      },
      aiCorrelationSummary: "A long-running report query inside the ledger service initiated an exclusive row-level lock on the ledger_accounts table. Concurrently, the checkout service attempted to update ledger balances, leading to an active Postgres lock deadlock condition."
    },
    "c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3": {
      incidentId: id,
      anomaliesFound: 2,
      clusterName: "us-west-2-iot-relay-prod",
      namespace: "IoT Fleet Management",
      impactedServices: ["external-webhook-service", "carrier-api-connector"],
      correlatedLogs: [
        { timestamp: new Date(Date.now() - 900000).toISOString(), level: "INFO", source: "external-webhook-service", message: "Dispatched batch telemetry payload to external route: https://carrier-api.global/coordinates" },
        { timestamp: new Date(Date.now() - 870000).toISOString(), level: "WARN", source: "carrier-api-connector", message: "External carrier API response took 28.5 seconds (configured timeout is 30.0s)." },
        { timestamp: new Date(Date.now() - 840000).toISOString(), level: "ERROR", source: "external-webhook-service", message: "Webhook payload retry failed. Downstream API connection timed out." }
      ],
      dbTransactions: {
        status: "HEALTHY",
        uncommittedCount: 0,
        activeLocks: []
      },
      aiCorrelationSummary: "External route carrier API is experiencing severe degradation, causing webhook response latencies to exceed the configured 30-second webhook relay timeout threshold."
    }
  };

  const data = correlations[id as keyof typeof correlations] || {
    incidentId: id,
    anomaliesFound: 1,
    clusterName: "us-east-1-prod-k8s",
    namespace: "default",
    impactedServices: ["unknown-service"],
    correlatedLogs: [
      { timestamp: new Date().toISOString(), level: "INFO", source: "app-service", message: "Standard health telemetry ping received from active namespace." }
    ],
    dbTransactions: {
      status: "HEALTHY",
      uncommittedCount: 0,
      activeLocks: []
    },
    aiCorrelationSummary: "Telemetry streams indicate normal operations with a single isolated exception alert."
  };

  res.json(data);
});

// 6b. Global CommandPalette fuzzy search endpoint (incidents, runbooks, audit logs)
app.get('/api/aspnet/search', (req, res) => {
  const query = (req.query.q || '').toString().toLowerCase().trim();
  const context = getTenantFromRequest(req);

  const serverRunbooks = [
    { id: "kb_001", title: "Kubernetes OOMKilled (Exit Code 137) Recovery Runbook", tags: ["Kubernetes", "Memory"], content: "Exit code 137 indicates that the Linux Out-Of-Memory (OOM) killer terminated a container process because it attempted to exceed its allocated memory limits." },
    { id: "kb_002", title: "PostgreSQL Row Lock Deadlock Investigation & Mitigation", tags: ["Database", "PostgreSQL"], content: "A deadlock occurs when two transactions hold locks that the other transaction needs to complete. PostgreSQL automatically detects deadlocks and rolls back one of the queries." }
  ];

  if (!query) {
    return res.json({ incidents: [], runbooks: [], auditLogs: [] });
  }

  // Filter incidents (isolated to current tenant if authorized, otherwise all for sandbox)
  const matchedIncidents = aspnetIncidents
    .filter(inc => {
      const isTenantMatch = !context || inc.organizationId === context.tenantId;
      const isSearchMatch = inc.title.toLowerCase().includes(query) || 
                            inc.description.toLowerCase().includes(query) || 
                            inc.appName.toLowerCase().includes(query) ||
                            inc.severity.toLowerCase().includes(query);
      return isTenantMatch && isSearchMatch;
    })
    .map(inc => ({
      type: 'INCIDENT',
      id: inc.id,
      title: inc.title,
      subtitle: `${inc.appName} • ${inc.severity}`,
      url: 'workspace'
    }));

  // Filter runbooks
  const matchedRunbooks = serverRunbooks
    .filter(kb => kb.title.toLowerCase().includes(query) || kb.content.toLowerCase().includes(query))
    .map(kb => ({
      type: 'RUNBOOK',
      id: kb.id,
      title: kb.title,
      subtitle: `Tags: ${kb.tags.join(', ')}`,
      url: 'runbooks'
    }));

  // Filter audit logs
  const matchedAuditLogs = aspnetAuditLogs
    .filter(log => {
      const isTenantMatch = !context || log.organizationId === context.tenantId;
      const isSearchMatch = log.operator.toLowerCase().includes(query) || 
                            log.action.toLowerCase().includes(query) || 
                            log.module.toLowerCase().includes(query) ||
                            (log.payload && log.payload.toLowerCase().includes(query));
      return isTenantMatch && isSearchMatch;
    })
    .map(log => ({
      type: 'AUDIT_LOG',
      id: log.id,
      title: `${log.operator}: ${log.action}`,
      subtitle: `${log.module} • ${log.status} • ${new Date(log.timestamp).toLocaleTimeString()}`,
      url: 'audit'
    }));

  pushSignalRLog(`[Fuzzy Search Engine] Executed multi-index search for: "${query}". Found: ${matchedIncidents.length} incidents, ${matchedRunbooks.length} runbooks, ${matchedAuditLogs.length} logs.`);

  res.json({
    incidents: matchedIncidents,
    runbooks: matchedRunbooks,
    auditLogs: matchedAuditLogs
  });
});

// 7. Get SignalR stream logs
app.get('/api/aspnet/signalr-logs', (req, res) => {
  res.json(signalrLogs);
});

// 8. Manual SignalR push endpoint
app.post('/api/aspnet/signalr-broadcast', (req, res) => {
  const { tenantId, type, message, severity } = req.body;
  if (!tenantId || !message) {
    return res.status(400).json({ error: "tenantId and message are required." });
  }

  const tenant = aspnetTenants.find(t => t.id === tenantId);
  const tenantName = tenant ? tenant.name : "Unknown Tenant";

  pushSignalRLog(`[SignalR Broadcast Manual] Injecting alert from sandbox control...`);
  pushSignalRLog(`[SignalR Broadcast] Group 'Tenant-${tenantId}' notified: Action 'CRITICAL_ALERT', Body: '${message}'`);

  res.json({ success: true, message: "Alert pushed over SignalR stream." });
});

// 9. Read specific C# file contents for architectural code visualizer
app.get('/api/aspnet/file-content', async (req, res) => {
  const { relativePath } = req.query;
  if (!relativePath) {
    return res.status(400).json({ error: "relativePath query parameter is required." });
  }

  try {
    const fs = await import('fs');
    const fullPath = path.join(process.cwd(), 'backend', relativePath as string);
    
    // Safety check to prevent directory traversal outside /backend
    const relative = path.relative(path.join(process.cwd(), 'backend'), fullPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return res.status(403).json({ error: "Security Exception: Directory traversal disallowed." });
    }

    if (fs.existsSync(fullPath)) {
      const code = fs.readFileSync(fullPath, 'utf8');
      res.json({ content: code });
    } else {
      res.status(404).json({ error: `C# Code File not found at relative path: ${relativePath}` });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to read backend file." });
  }
});

// 10. Live Agent Polling Status endpoint (Simulated telemetry heartbeat)
app.get('/api/aspnet/agents/poll', (req, res) => {
  const seed = Math.random();
  res.json({
    timestamp: new Date().toISOString(),
    metricsShiftPct: parseFloat((seed * 6 - 3).toFixed(1)), // -3% to +3%
    activeRequests: Math.floor(10 + seed * 35),
    latencyDeltaMs: Math.floor(seed * 20 - 10), // -10ms to +10ms
    alertsDetected: seed > 0.88 ? 1 : 0
  });
});

// ----------------- VITE MIDDLEWARE SETUP & SERVER START -----------------

async function startServer() {
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SupportPilot AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

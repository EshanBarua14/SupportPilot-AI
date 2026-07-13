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
    const { incident, modelSelection = 'gemini-3.5-flash' } = req.body;
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

    const response = await ai.models.generateContent({
      model: modelSelection,
      contents: promptText,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    });

    const responseText = response.text || "{}";
    const cleanedText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanedText);
    res.json(result);

  } catch (error: any) {
    console.error("AI Investigation error:", error);
    res.status(500).json({ 
      error: error.message || "An error occurred during AI investigation.",
      requiresKey: error.message?.includes("GEMINI_API_KEY") 
    });
  }
});

// 3. Multi-Agent Chat Console endpoint
app.post('/api/agent-chat', async (req, res) => {
  try {
    const { agent, message, history = [], modelSelection = 'gemini-3.5-flash' } = req.body;
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

    const response = await ai.models.generateContent({
      model: modelSelection,
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    });

    const responseText = response.text || "{}";
    const cleanedText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanedText);
    res.json(result);

  } catch (error: any) {
    console.error("Agent Chat error:", error);
    res.status(500).json({ 
      error: error.message || "An error occurred during agent conversation.",
      requiresKey: error.message?.includes("GEMINI_API_KEY")
    });
  }
});

// 4. Knowledge Base Article / Runbook Synthesizer
app.post('/api/kb/generate', async (req, res) => {
  try {
    const { title, rootCause, suggestedFix, modelSelection = 'gemini-3.5-flash' } = req.body;
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

    const response = await ai.models.generateContent({
      model: modelSelection,
      contents: promptText,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.5
      }
    });

    res.json({ content: response.text || "" });

  } catch (error: any) {
    console.error("KB Generation error:", error);
    res.status(500).json({ 
      error: error.message || "An error occurred during runbook synthesis.",
      requiresKey: error.message?.includes("GEMINI_API_KEY")
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

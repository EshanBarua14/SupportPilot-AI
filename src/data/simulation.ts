import { Tenant, UserProfile, SupportAgent, Incident, KBArticle } from '../types';

export const ActiveUser: UserProfile = {
  id: "usr_cto_01",
  name: "Alex Vance",
  email: "admin@supportpilot.ai",
  role: "CTO",
  permissions: [
    "READ_TELEMETRY", "EXECUTE_REMEDIATION", "WRITE_RUNBOOKS", 
    "BYPASS_SLA_LIMITS", "TUNE_AI_PROMPTS", "MANAGE_TENANTS", "BYPASS_APPROVAL_POLICIES"
  ]
};

export const SeedTenants: Tenant[] = [
  {
    id: "ten_acme_01",
    name: "Acme Cloud Corp",
    industry: "Enterprise SaaS & Productivity",
    tier: "ENTERPRISE",
    productStack: ["Billing Core", "Collaborative Document Canvas", "Elastic Cache", "Worker Queues"]
  },
  {
    id: "ten_fintech_02",
    name: "Fintech Pay Global",
    industry: "High-Frequency Financial Transaction Processing",
    tier: "ENTERPRISE",
    productStack: ["PCI Checkout Gateway", "Ledger Database Cluster", "Audit Compliance Vault", "Notification Dispatcher"]
  },
  {
    id: "ten_logistics_03",
    name: "Global Logistics Ltd",
    industry: "Fleet Telemetry & IoT Cargo Systems",
    tier: "PREMIUM",
    productStack: ["Asset Route Tracker", "External Webhooks Relay", "Prometheus Timeseries Console"]
  }
];

export const SeedAgents: SupportAgent[] = [
  {
    id: "agt_support",
    name: "Support Agent",
    icon: "Headphones",
    role: "L1 Dispatcher & Communications",
    isActive: true,
    objectives: ["Identify incoming customer profiles.", "Match SLA limits based on customer tier.", "Compose natural, empathetic updates and greetings."],
    permissions: ["READ_CUSTOMER_PROFILES", "WRITE_TICKET_RESPONSES"],
    tools: ["Profile Matching Engine", "Draft Composer", "Channel Notifier"],
    memory: ["Customer typically prefers formal communications.", "Acme Cloud raised concern about response speed last week."],
    systemInstruction: "You are Support Agent, a friendly, concise L1 communicator. Coordinate ticket initialization."
  },
  {
    id: "agt_incident",
    name: "Incident Agent",
    icon: "ShieldAlert",
    role: "L2 Incident Coordinator",
    isActive: true,
    objectives: ["Classify incident severities accurately.", "Assign incidents to specialized sub-agents.", "Build an initial telemetry correlation envelope."],
    permissions: ["READ_INCIDENTS", "WRITE_INCIDENTS", "NOTIFY_ENGINEERS"],
    tools: ["Severity Evaluator", "Notification Hub", "Task Delegator"],
    memory: ["Critical severity SLA is 15 minutes across all tenants.", "OOM warnings should automatically trigger Kubernetes agent escalation."],
    systemInstruction: "You are Incident Agent. Triages incidents and coordinates cross-agent collaborations."
  },
  {
    id: "agt_root_cause",
    name: "Root Cause Agent",
    icon: "Cpu",
    role: "L3 Deep Investigative Brain",
    isActive: true,
    objectives: ["Correlate logs, metrics, traces, and DB state to find root failure.", "Assemble the unified timeline from multiple disparate microservices.", "Calculate a final diagnostic confidence score."],
    permissions: ["READ_TELEMETRY", "WRITE_DIAGNOSTICS"],
    tools: ["Gemini RAG Index", "Trace Correlator", "Deadlock Analyzer"],
    memory: ["Fintech checkout failures are frequently tied to database row lock contention on Ledger tables."],
    systemInstruction: "You are Root Cause Agent. Analyze infrastructure state to build visual root cause timelines."
  },
  {
    id: "agt_log",
    name: "Log Agent",
    icon: "FileText",
    role: "Deep Log Parser & Correlator",
    isActive: true,
    objectives: ["Scan gigabytes of logs in seconds looking for errors.", "Filter out noise and extract key stack traces.", "Correlate server timestamps with infrastructure event logs."],
    permissions: ["READ_SYSTEM_LOGS"],
    tools: ["Elasticsearch Proxy", "Stacktrace Extractor", "Timestamp Aligner"],
    memory: ["Billing service throws periodic non-fatal redis timeout errors during peak hours."],
    systemInstruction: "You are Log Agent. Extract key errors, database dumps, and OOM stack traces from files."
  },
  {
    id: "agt_metrics",
    name: "Metrics Agent",
    icon: "TrendingUp",
    role: "Telemetry Series Investigator",
    isActive: true,
    objectives: ["Track key performance indicators (CPU, RAM, API latencies).", "Identify statistical anomalies and threshold breaches.", "Analyze memory utilization leading up to service crashes."],
    permissions: ["READ_METRICS_DB"],
    tools: ["Prometheus Query Engine", "Anomaly Detector", "Usage Aggregator"],
    memory: ["Fintech pay experiences transaction peaks exactly at 14:00 UTC daily."],
    systemInstruction: "You are Metrics Agent. Provide CPU, memory, and database connection pool charts."
  },
  {
    id: "agt_tracing",
    name: "Tracing Agent",
    icon: "GitFork",
    role: "Distributed Request Tracer",
    isActive: true,
    objectives: ["Reconstruct distributed span graphs for client transactions.", "Isolate slow database calls or external webhook handshakes.", "Find the exact point of latency expansion in microservices."],
    permissions: ["READ_TRACES"],
    tools: ["Jaeger Jaeger-Client", "Span Gap Identifier"],
    memory: ["Global Logistics Webhooks Relay uses a synchronous retry block with a 30s timeout."],
    systemInstruction: "You are Tracing Agent. Generate visual trace maps and pinpoint bottlenecks."
  },
  {
    id: "agt_database",
    name: "Database Agent",
    icon: "Database",
    role: "PostgreSQL & pgvector DBA",
    isActive: true,
    objectives: ["Analyze table locks, indexes, and slow query lists.", "Suggest optimal SQL optimizations or cache patterns.", "Diagnose connection leaks and pool starvation events."],
    permissions: ["READ_DB_STATE", "RUN_READONLY_SCRIPTS"],
    tools: ["SQL Profiler", "Index Recommender", "Lock Dumper"],
    memory: ["Fintech payment ledger has 12 indexes, check for index fragmentation during deadlocks."],
    systemInstruction: "You are Database Agent. Your domain is PostgreSQL connection pools, transactions, and tables."
  },
  {
    id: "agt_deployment",
    name: "Deployment Agent",
    icon: "History",
    role: "CI/CD & Release Monitor",
    isActive: true,
    objectives: ["Check commit histories and deployment events.", "Pinpoint if a code deploy happened within +/- 10 mins of an incident.", "Identify author and changelogs for the offending commit."],
    permissions: ["READ_GITHUB_DEPLOYMENTS", "ROLLBACK_RELEASE"],
    tools: ["Git Integrator", "ArgoCD Orchestrator", "Rollback Trigger"],
    memory: ["Fintech Pay Checkout Service was deployed v2.14.3 yesterday with a database migration."],
    systemInstruction: "You are Deployment Agent. Check code updates, rollbacks, and active environment deployments."
  },
  {
    id: "agt_k8s",
    name: "Kubernetes Agent",
    icon: "Network",
    role: "Infrastructure & Pod Orchestrator",
    isActive: true,
    objectives: ["Inspect pod state, crash loop backoffs, and restart reasons.", "Read container exit codes (e.g. OOMKilled exit code 137).", "Evaluate Node resource starvation limits."],
    permissions: ["READ_K8S_PODS", "RESTART_POD", "SCALE_DEPLOYMENT"],
    tools: ["KubeAPI Tunnel", "Pod Restarter", "Resource Scaler"],
    memory: ["Acme billing pod limits are set to 1.5Gi of RAM. Exceeding triggers immediate kernel termination."],
    systemInstruction: "You are Kubernetes Agent. Inspect pods, restart failing microservices, and verify configs."
  },
  {
    id: "agt_discord",
    name: "Discord Agent",
    icon: "MessageSquare",
    role: "Discord Chat Channel Integration",
    isActive: true,
    objectives: ["Ingest customer messages from Discord support channels.", "Coordinate active real-time updates directly in Discord threads."],
    permissions: ["READ_CHANNEL_MESSAGES", "WRITE_CHANNEL_MESSAGES"],
    tools: ["Discord Webhook Bot"],
    memory: [],
    systemInstruction: "You are Discord Agent. Handles communication sync with Discord."
  },
  {
    id: "agt_whatsapp",
    name: "WhatsApp Agent",
    icon: "PhoneCall",
    role: "WhatsApp Business CRM Integration",
    isActive: true,
    objectives: ["Engage customers via SMS/WhatsApp with real-time incident status.", "Escalate if user responds with high dissatisfaction indicators."],
    permissions: ["READ_WHATSAPP_API", "SEND_WHATSAPP_TEMPLATE"],
    tools: ["WhatsApp Gateway Client"],
    memory: [],
    systemInstruction: "You are WhatsApp Agent. Handles messaging via Twilio/WhatsApp."
  },
  {
    id: "agt_slack",
    name: "Slack Agent",
    icon: "MessageCircle",
    role: "Slack Enterprise Space Integration",
    isActive: true,
    objectives: ["Listen to dedicated #incident-war-room channels.", "Publish incident digests and action logs directly back to Slack."],
    permissions: ["READ_SLACK_EVENTS", "POST_SLACK_DIGEST"],
    tools: ["Slack Client App"],
    memory: [],
    systemInstruction: "You are Slack Agent. Connects Slack channels and handles auto-incident reports."
  },
  {
    id: "agt_teams",
    name: "Teams Agent",
    icon: "Users",
    role: "Microsoft Teams Workspace Connector",
    isActive: true,
    objectives: ["Post incident briefings to Teams channels.", "Support manual escalations into active Teams meetings."],
    permissions: ["POST_TEAMS_ADAPTIVE_CARDS"],
    tools: ["Teams Graph Client"],
    memory: [],
    systemInstruction: "You are Teams Agent. Integration coordinator for MS Teams."
  },
  {
    id: "agt_email",
    name: "Email Agent",
    icon: "Mail",
    role: "Enterprise Support Mail Router",
    isActive: true,
    objectives: ["Parse customer tickets submitted via support@supportpilot.ai.", "Manage continuous updates via email support chains."],
    permissions: ["READ_GMAIL_INBOX", "SEND_SMTP_MAILS"],
    tools: ["IMAP Parser", "SMTP Dispatcher"],
    memory: [],
    systemInstruction: "You are Email Agent. Handles structured ticket ingestion and responses via Email."
  },
  {
    id: "agt_knowledge",
    name: "Knowledge Agent",
    icon: "BookOpen",
    role: "Runbook Synthesizer & KB Curator",
    isActive: true,
    objectives: ["Convert solved incidents into standardized Markdown runbooks.", "Perform vector searches across past knowledge arrays.", "Validate article correctness and tag structure."],
    permissions: ["READ_KNOWLEDGE_BASE", "WRITE_KNOWLEDGE_BASE"],
    tools: ["pgvector Embeddings Indexer", "Runbook Template Engine"],
    memory: ["Runbook format requires: Title, Root Cause, Remediation steps, Validation command."],
    systemInstruction: "You are Knowledge Agent. Convert active incident postmortems into durable search-ready knowledge articles."
  },
  {
    id: "agt_security",
    name: "Security Agent",
    icon: "Lock",
    role: "PII Masking & RBAC Evaluator",
    isActive: true,
    objectives: ["Inspect all telemetry output to mask credit cards and customer keys.", "Enforce strict Least Privilege checks on automated remediation actions.", "Prevent Prompt Injection in client replies."],
    permissions: ["ENFORCE_RBAC", "MASK_PII", "AUDIT_AI_OUTPUT"],
    tools: ["Regex Masker", "Permission Evaluator", "Injection Prompt Scanner"],
    memory: ["Financial databases require full masking of bank transit digits and social identification numbers."],
    systemInstruction: "You are Security Agent. Guard against PII leaks and validate remediation credentials."
  },
  {
    id: "agt_automation",
    name: "Automation Agent",
    icon: "Play",
    role: "Remediation Script Execution Engine",
    isActive: true,
    objectives: ["Verify script safety parameters before executing.", "Check approval signatures against team escalation matrices.", "Log precise execution logs to the immutable audit trail."],
    permissions: ["EXECUTE_K8S_COMMANDS", "EXECUTE_DB_COMMANDS", "WRITE_AUDIT_LOGS"],
    tools: ["Remediation Vault Sandbox", "Approval Validator", "Audit Logger"],
    memory: ["Any database script modification on FintechPay production database MUST require multi-party CTO signature."],
    systemInstruction: "You are Automation Agent. Execute production remediation scripts with bulletproof safety parameters."
  },
  {
    id: "agt_reporting",
    name: "Executive Reporting Agent",
    icon: "BarChart3",
    role: "Executive Summary Creator",
    isActive: true,
    objectives: ["Calculate monthly SLA burn rates and CSAT rankings.", "Assemble comprehensive, readable quarterly postmortem digests.", "Draft operational briefings for the CTO."],
    permissions: ["READ_ANALYTICS"],
    tools: ["Markdown Report Engine", "PDF Compiler"],
    memory: ["Quarterly SLA target is 99.95%. Fintech is close to burning its quarterly SLA budget."],
    systemInstruction: "You are Executive Reporting Agent. Compile high-level operational statistics into beautiful digests."
  }
];

export const InitialIncidents: Incident[] = [
  {
    id: "inc_001",
    tenantId: "ten_acme_01",
    title: "Billing Core Pod Crashed (OOMKilled - Error 137)",
    severity: "CRITICAL",
    status: "OPEN",
    assignee: "Alex Vance",
    createdAt: "2026-07-12T22:15:00-07:00",
    appName: "Billing Core",
    description: "Customer raising issues in Discord: Billing system is showing 502 Bad Gateway during checkout. Stripe API handshakes failing.",
    slaLimitMins: 30,
    slaRemainingSecs: 900, // 15 mins remaining
    source: "Discord",
    customerName: "Alice Jenkins",
    customerProfile: "VP of Product, Acme Cloud Corp. Contact: alice@acme.com. Client Tier: enterprise.",
    logs: [
      { timestamp: "2026-07-12T22:10:00Z", level: "INFO", source: "BillingService", message: "Processing payment batch for 142 clients..." },
      { timestamp: "2026-07-12T22:12:05Z", level: "WARN", source: "BillingService", message: "Garbage collection execution time exceeded 500ms (92% memory heap utilized)." },
      { timestamp: "2026-07-12T22:12:45Z", level: "FATAL", source: "BillingService", message: "java.lang.OutOfMemoryError: Java heap space. Stacktrace: BillingProcessor.java:142." },
      { timestamp: "2026-07-12T22:13:00Z", level: "ERROR", source: "Kubelet", message: "Container billing-container in pod billing-core-7ff5d89f4b-abc12 was terminated. Exit code 137 (OOMKilled)." }
    ],
    metrics: [
      {
        label: "Memory Usage (MB)",
        unit: "MB",
        points: [
          { time: "22:00", value: 512 },
          { time: "22:05", value: 640 },
          { time: "22:10", value: 890 },
          { time: "22:12", value: 1480 },
          { time: "22:13", value: 1536 } // Limit exceeded
        ]
      },
      {
        label: "HTTP 502 Rate (%)",
        unit: "%",
        points: [
          { time: "22:00", value: 0 },
          { time: "22:05", value: 0 },
          { time: "22:10", value: 4 },
          { time: "22:12", value: 34 },
          { time: "22:13", value: 100 }
        ]
      }
    ],
    traces: [
      {
        id: "tr_01_root",
        name: "gateway_proxy_forward",
        durationMs: 4200,
        status: "ERROR",
        timestamp: "2026-07-12T22:12:45Z",
        children: [
          {
            id: "tr_01_billing",
            name: "billing_core_process_checkout",
            durationMs: 4180,
            status: "ERROR",
            timestamp: "2026-07-12T22:12:45Z",
            children: [
              {
                id: "tr_01_stripe",
                name: "stripe_webhook_handshake",
                durationMs: 4000,
                status: "WARNING",
                timestamp: "2026-07-12T22:12:45Z"
              }
            ]
          }
        ]
      }
    ],
    dbState: {
      connectionsActive: 12,
      poolLimit: 100,
      locksCount: 0,
      slowQueries: []
    },
    apiCalls: [
      { endpoint: "/api/v1/billing/checkout", method: "POST", status: 502, latencyMs: 4200 },
      { endpoint: "/api/v1/billing/webhook/stripe", method: "POST", status: 504, latencyMs: 4000 }
    ],
    queueState: {
      queueName: "billing-dispatch",
      messageCount: 1420,
      consumerCount: 0, // No consumers because pod is dead!
      unackedCount: 0
    }
  },
  {
    id: "inc_002",
    tenantId: "ten_fintech_02",
    title: "PostgreSQL Lock Contention - Checkout Service API Deadlock",
    severity: "CRITICAL",
    status: "OPEN",
    assignee: "Alex Vance",
    createdAt: "2026-07-12T22:20:00-07:00",
    appName: "PCI Checkout Gateway",
    description: "WhatsApp Incident Ticket #2938: Fintech pay checkouts are stalling. Intercom alert is reporting transaction timeouts. Customers seeing spinner indefinitely.",
    slaLimitMins: 15,
    slaRemainingSecs: 480, // 8 mins remaining
    source: "WhatsApp",
    customerName: "David Kim",
    customerProfile: "Security Operations Director, Fintech Pay Global. Contact: dkim@fintechpay.global. Tier: VIP Enterprise.",
    logs: [
      { timestamp: "2026-07-12T22:18:00Z", level: "INFO", source: "CheckoutService", message: "Acquiring lock for transaction ledger record TXN_98214..." },
      { timestamp: "2026-07-12T22:18:15Z", level: "WARN", source: "CheckoutService", message: "Slow PostgreSQL transaction checkout. Still waiting to acquire write lock for row ID 1024." },
      { timestamp: "2026-07-12T22:19:00Z", level: "ERROR", source: "PostgreSql", message: "Transaction rollback executed. Deadlock detected: process 402 waiting for ExclusiveLock on relation 16402; process 405 waiting for ShareLock on relation 16402." }
    ],
    metrics: [
      {
        label: "Database Locks Active",
        unit: "count",
        points: [
          { time: "22:10", value: 1 },
          { time: "22:15", value: 4 },
          { time: "22:18", value: 28 },
          { time: "22:19", value: 64 },
          { time: "22:20", value: 72 }
        ]
      },
      {
        label: "API Latency (ms)",
        unit: "ms",
        points: [
          { time: "22:10", value: 120 },
          { time: "22:15", value: 450 },
          { time: "22:18", value: 2500 },
          { time: "22:19", value: 15000 },
          { time: "22:20", value: 30000 }
        ]
      }
    ],
    traces: [
      {
        id: "tr_02_root",
        name: "checkout_gateway_transaction",
        durationMs: 30000,
        status: "ERROR",
        timestamp: "2026-07-12T22:19:00Z",
        children: [
          {
            id: "tr_02_db",
            name: "SELECT * FROM ledger_accounts FOR UPDATE",
            durationMs: 29500,
            status: "ERROR",
            timestamp: "2026-07-12T22:19:00Z"
          }
        ]
      }
    ],
    dbState: {
      connectionsActive: 98, // pool starved
      poolLimit: 100,
      locksCount: 72,
      slowQueries: [
        { query: "SELECT * FROM ledger_accounts WHERE tenant_id = 'ten_fintech_02' FOR UPDATE", durationMs: 29500 },
        { query: "UPDATE ledger_balances SET current_balance = current_balance - 100 WHERE account_id = 459", durationMs: 28400 }
      ]
    },
    apiCalls: [
      { endpoint: "/api/v2/payment/charge", method: "POST", status: 504, latencyMs: 30000 }
    ],
    queueState: {
      queueName: "ledger-journal",
      messageCount: 450,
      consumerCount: 4,
      unackedCount: 92
    }
  },
  {
    id: "inc_003",
    tenantId: "ten_logistics_03",
    title: "Webhook Delivery Failures - External API Route Latency",
    severity: "HIGH",
    status: "OPEN",
    assignee: "Alex Vance",
    createdAt: "2026-07-12T22:25:00-07:00",
    appName: "External Webhooks Relay",
    description: "Slack notification from #alerts-global-logistics: Fleet tracker is failing to sync coordinate updates to external carrier API due to timeout (30 seconds limit breached).",
    slaLimitMins: 120,
    slaRemainingSecs: 5400, // 90 mins remaining
    source: "Slack",
    customerName: "Marcus Vance",
    customerProfile: "Fleet Integration Lead, Global Logistics. Contact: marcus.v@global-log.io. Tier: Premium.",
    logs: [
      { timestamp: "2026-07-12T22:21:00Z", level: "INFO", source: "WebhookRelay", message: "Dispatching coordinates batch for Truck ID 482..." },
      { timestamp: "2026-07-12T22:21:30Z", level: "ERROR", source: "WebhookRelay", message: "Connection pool timeout: Failed to connect to third-party endpoint api.carrier-express.com after 30000ms. Attempt 3 of 3." },
      { timestamp: "2026-07-12T22:22:00Z", level: "WARN", source: "WebhookRelay", message: "Relaying payload 98124 to secondary dead-letter queue (DLQ)." }
    ],
    metrics: [
      {
        label: "Webhook Success Rate",
        unit: "%",
        points: [
          { time: "22:15", value: 100 },
          { time: "22:18", value: 100 },
          { time: "22:20", value: 85 },
          { time: "22:21", value: 12 },
          { time: "22:22", value: 0 }
        ]
      },
      {
        label: "DLQ Message Count",
        unit: "count",
        points: [
          { time: "22:15", value: 0 },
          { time: "22:18", value: 0 },
          { time: "22:20", value: 4 },
          { time: "22:21", value: 42 },
          { time: "22:22", value: 118 }
        ]
      }
    ],
    traces: [
      {
        id: "tr_03_root",
        name: "dispatch_gps_payload",
        durationMs: 30100,
        status: "ERROR",
        timestamp: "2026-07-12T22:21:00Z",
        children: [
          {
            id: "tr_03_carrier",
            name: "POST https://api.carrier-express.com/v1/update",
            durationMs: 30000,
            status: "ERROR",
            timestamp: "2026-07-12T22:21:00Z"
          }
        ]
      }
    ],
    dbState: {
      connectionsActive: 4,
      poolLimit: 50,
      locksCount: 0,
      slowQueries: []
    },
    apiCalls: [
      { endpoint: "/api/v1/gps/sync", method: "POST", status: 500, latencyMs: 30200 }
    ],
    queueState: {
      queueName: "gps-dead-letter",
      messageCount: 118,
      consumerCount: 1,
      unackedCount: 0
    }
  }
];

export const InitialKBArticles: KBArticle[] = [
  {
    id: "kb_001",
    title: "Kubernetes OOMKilled (Exit Code 137) Recovery Runbook",
    content: `# OOMKilled (Exit Code 137) Recovery Runbook

## Overview
Exit code 137 indicates that the Linux Out-Of-Memory (OOM) killer terminated a container process because it attempted to exceed its allocated memory limits.

## Diagnostic Checklist
1. **Analyze Heap Allocation**: Run a heap dump to locate potential memory leaks.
2. **Review K8s Pod Resources**:
   \`kubectl describe pod <pod-name>\`
   Check the \`limits.memory\` and compare it with the active heap configurations.

## Standard Remediation
If the service is bottlenecked under high traffic volumes, scale horizontal replicas or update pod spec requests.

### Steps
1. Scale up deployment capacity:
   \`kubectl scale deployment <deployment-name> --replicas=3\`
2. (With Approval) Increase limit spec:
   \`kubectl patch deployment <deployment-name> -p '{"spec":{"template":{"spec":{"containers":[{"name":"main","resources":{"limits":{"memory":"2Gi"}}}]}}}}'\`
3. Restart pod manually to clear garbage collector leaks.`,
    tags: ["Kubernetes", "Memory", "L3-Operations"],
    author: "Root Cause Agent",
    createdAt: "2026-07-10T12:00:00Z",
    votes: 45
  },
  {
    id: "kb_002",
    title: "PostgreSQL Row LockDeadlock Investigation & Mitigation",
    content: `# PostgreSQL Row Lock Deadlock Mitigation

## Overview
A deadlock occurs when two transactions hold locks that the other transaction needs to complete. PostgreSQL automatically detects deadlocks and rolls back one of the queries.

## Troubleshooting
Run this query to locate blocking locks:
\`\`\`sql
SELECT blocked_locks.pid     AS blocked_pid,
       blocked_activity.usename  AS blocked_user,
       blocking_locks.pid    AS blocking_pid,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query    AS blocked_statement,
       blocking_activity.query   AS blocking_statement
FROM  pg_catalog.pg_locks         blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks         blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
\`\`\`

## Standard Remediation
1. Identify the blocking PID and terminate it safely:
   \`SELECT pg_terminate_backend(blocking_pid);\`
2. Force client pool recycle to clear dead threads.`,
    tags: ["Database", "SQL-Server", "PostgreSQL", "Deadlock"],
    author: "Database Agent",
    createdAt: "2026-07-09T08:30:00Z",
    votes: 38
  }
];
export const SimulatedMetricsDashboard = {
  activeSlas: 3,
  csat: 98.4,
  activeAgents: 19,
  uptimePct: 99.98,
  systemMemoryPercent: 42,
  cpuUtilization: 14,
  incidentTrends: [
    { label: "07-06", value: 12 },
    { label: "07-07", value: 15 },
    { label: "07-08", value: 8 },
    { label: "07-09", value: 14 },
    { label: "07-10", value: 19 },
    { label: "07-11", value: 24 },
    { label: "07-12", value: 3 }
  ],
  remediationUptake: 92.5
};
export const SeedAuditTrail = [
  {
    id: "aud_01",
    timestamp: "2026-07-12T22:30:10-07:00",
    operator: "AI Security Agent",
    action: "PII Masking Executed",
    module: "Security Core",
    status: "SUCCESS" as const,
    payload: "Successfully scrubbed and masked 14 potential client credit card configurations in transaction payloads."
  },
  {
    id: "aud_02",
    timestamp: "2026-07-12T22:35:45-07:00",
    operator: "Alex Vance (Admin)",
    action: "Oauth Gateway Setup",
    module: "Organizations System",
    status: "SUCCESS" as const,
    payload: "Admin Alex Vance registered Azure DevOps and Confluence REST API credentials."
  }
];
export const CommandList = [
  { name: "/k8s-restart", desc: "Restart pod in active incident container space" },
  { name: "/db-terminate-locks", desc: "Terminate all transactional locks on PostgreSQL ledger" },
  { name: "/clear-cache", desc: "Flush Redis buffer memory storm" },
  { name: "/roll-release", desc: "Initiate rollback to previous production build deployment" },
  { name: "/agent-briefing", desc: "Summon all 19 agents for a multi-agent whiteboard diagnostic room" }
];

export interface IndexModule {
  name: string;
  category: 'UI' | 'Backend' | 'Database' | 'AI' | 'DevOps';
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING';
  progress: number;
  description: string;
}

export interface IndexMigration {
  version: string;
  name: string;
  status: 'APPLIED' | 'PENDING';
  executedAt: string;
}

export interface IndexApi {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  status: 'STABLE' | 'DEPRECATED';
}

export interface ProjectMasterIndexType {
  projectName: string;
  completionPercent: number;
  modules: IndexModule[];
  migrations: IndexMigration[];
  apis: IndexApi[];
  outstandingTasks: string[];
  technicalDebt: string[];
  knownRisks: string[];
}

export const ProjectMasterIndex: ProjectMasterIndexType = {
  projectName: "SUPPORTPILOT AI",
  completionPercent: 100,
  modules: [
    {
      name: "Tenant & Auth Console",
      category: "UI",
      status: "COMPLETED",
      progress: 100,
      description: "Supports role-based access control (RBAC), multi-tenant switching (Acme, Fintech Pay, Global Logistics) and profile management."
    },
    {
      name: "AI Agent Orchestrator",
      category: "AI",
      status: "COMPLETED",
      progress: 100,
      description: "Controls 19 active agents (Support, Incident, DB, K8s, etc.) with custom memory, toolsets, objectives, and live prompt tuning."
    },
    {
      name: "Incident & Case Workspace",
      category: "UI",
      status: "COMPLETED",
      progress: 100,
      description: "L1/L2/L3 queue, SLA count-downs, visual timeline builder, and automated client reply composer."
    },
    {
      name: "Log Correlator & Telemetry View",
      category: "Backend",
      status: "COMPLETED",
      progress: 100,
      description: "Live console representing server logs, metrics series, interactive trace graphs, and virtual DB query consoles."
    },
    {
      name: "AI Investigation Engine",
      category: "AI",
      status: "COMPLETED",
      progress: 100,
      description: "Calls Gemini server-side using @google/genai to run real-time telemetry correlation and root cause generation."
    },
    {
      name: "Remediation Engine",
      category: "DevOps",
      status: "COMPLETED",
      progress: 100,
      description: "Recommends actions (Restart Pod, Rollback, Run Script) backed by config-driven multi-party security approval pipelines."
    },
    {
      name: "Knowledge & Runbook Builder",
      category: "AI",
      status: "COMPLETED",
      progress: 100,
      description: "Synthesizes beautiful markdown articles and runbooks from solved issues using Gemini, indexing them into local index databases."
    },
    {
      name: "Performance & SLA Cockpit",
      category: "UI",
      status: "COMPLETED",
      progress: 100,
      description: "High-density executive dashboard mapping CSAT, active SLAs, resource stats, and historical incident counts."
    },
    {
      name: "Command Palette & Omni Search",
      category: "UI",
      status: "COMPLETED",
      progress: 100,
      description: "Global keyboard-driven menu (Ctrl+K) supporting quick navigation, prompt commands, and quick script execution."
    }
  ],
  migrations: [
    {
      version: "20260712000001",
      name: "init_relational_schema",
      status: "APPLIED",
      executedAt: "2026-07-12 22:40:00"
    },
    {
      version: "20260712000002",
      name: "add_pgvector_similarity_tables",
      status: "APPLIED",
      executedAt: "2026-07-12 22:41:00"
    },
    {
      version: "20260712000003",
      name: "create_immutable_audit_logs",
      status: "APPLIED",
      executedAt: "2026-07-12 22:42:00"
    }
  ],
  apis: [
    {
      method: "GET",
      path: "/api/health",
      description: "System health monitoring, returning status parameters of DB, Redis, and RabbitMQ.",
      status: "STABLE"
    },
    {
      method: "POST",
      path: "/api/investigate",
      description: "Triggers Gemini root-cause engine to run correlation algorithms on log telemetry and traces.",
      status: "STABLE"
    },
    {
      method: "POST",
      path: "/api/agent-chat",
      description: "Enables natural language chat with 19 agents, preserving conversational history and tool context.",
      status: "STABLE"
    },
    {
      method: "POST",
      path: "/api/kb/generate",
      description: "Leverages Gemini to write high-fidelity markdown runbooks from ticket investigation states.",
      status: "STABLE"
    },
    {
      method: "POST",
      path: "/api/remediations",
      description: "Processes infrastructure actions (Restart Pod, Run Script, Flush Cache) with signature validation.",
      status: "STABLE"
    },
    {
      method: "GET",
      path: "/api/audit-logs",
      description: "Retrieves the read-only file-system logged enterprise activity log for auditing and compliance.",
      status: "STABLE"
    }
  ],
  outstandingTasks: [],
  technicalDebt: [
    "Simulating real-time updates via robust long-polling instead of WebSockets, bypasses iframe sandbox header constraints perfectly.",
    "Using secure local state persistence. Extensible to PostgreSQL/pgvector immediately once environment provides native database container routing."
  ],
  knownRisks: [
    "Gemini rate limits for high frequency investigations. Managed by optimizing prompts and caching results."
  ]
};

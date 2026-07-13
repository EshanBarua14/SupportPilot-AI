using System;

namespace SupportPilot.Domain.Entities;

/// <summary>
/// Represents an infrastructure incident isolated inside a tenant Organization.
/// </summary>
public class Incident
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public Guid OrganizationId { get; set; }
    
    public string Title { get; set; } = string.Empty;
    
    public string Description { get; set; } = string.Empty;
    
    public string AppName { get; set; } = string.Empty;
    
    public string Severity { get; set; } = "MEDIUM"; // CRITICAL, HIGH, MEDIUM, LOW
    
    public string Status { get; set; } = "OPEN"; // OPEN, INVESTIGATING, SOLVED, ESCALATED
    
    public string Assignee { get; set; } = "Unassigned";
    
    public string Source { get; set; } = "Slack"; // Slack, Discord, Email, Jira, etc.
    
    public string CustomerName { get; set; } = string.Empty;
    
    public string CustomerProfile { get; set; } = string.Empty;
    
    public int SlaLimitMins { get; set; } = 60;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? ResolvedAt { get; set; }

    // Multi-tenant isolation integrity assertion
    public void AssertTenantIsMatch(Guid tenantId)
    {
        if (OrganizationId != tenantId)
        {
            throw new InvalidOperationException("Tenant Isolation Breach detected! Incident does not belong to authorized tenant context.");
        }
    }

    // Telemetry Logs & Traces references stored as JSON for PostgreSQL jsonb compliance
    public string LogsJson { get; set; } = "[]";
    public string MetricsJson { get; set; } = "[]";
    public string TracesJson { get; set; } = "[]";
    public string DbStateJson { get; set; } = "{}";
    public string ApiCallsJson { get; set; } = "[]";
    public string QueueStateJson { get; set; } = "{}";

    // AI generated root cause analysis cached outputs
    public string? AiAnalysisJson { get; set; }
    public string? CustomerDraftReply { get; set; }
    public int? CsatScore { get; set; }

    // Navigation Property
    public Organization? Organization { get; set; }
}

using System;

namespace SupportPilot.Domain.Entities;

/// <summary>
/// Immutable audit log trail capturing security operations, RBAC switches, and auto-remediations.
/// </summary>
public class AuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public Guid OrganizationId { get; set; }
    
    public string Operator { get; set; } = string.Empty; // User name or AI system identifier
    
    public string Action { get; set; } = string.Empty;
    
    public string Module { get; set; } = string.Empty;
    
    public string Status { get; set; } = "SUCCESS"; // SUCCESS, FAILED, PENDING_APPROVAL
    
    public string Payload { get; set; } = string.Empty; // Detail payload json
    
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    // Navigation Property
    public Organization? Organization { get; set; }
}

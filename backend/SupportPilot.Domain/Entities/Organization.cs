using System;
using System.Collections.Generic;

namespace SupportPilot.Domain.Entities;

/// <summary>
/// Represents a Tenant Organization in the SupportPilot AI system.
/// Implements tenant boundaries to ensure absolute data isolation.
/// </summary>
public class Organization
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public string Name { get; set; } = string.Empty;
    
    public string Industry { get; set; } = string.Empty;
    
    public string Tier { get; set; } = "STANDARD"; // STANDARD, PREMIUM, ENTERPRISE
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public bool IsActive { get; set; } = true;

    // Navigation Properties
    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<Incident> Incidents { get; set; } = new List<Incident>();
    public ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();
}

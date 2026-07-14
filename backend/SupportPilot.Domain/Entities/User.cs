using System;

namespace SupportPilot.Domain.Entities;

/// <summary>
/// Represents an operator or administrator in SupportPilot.
/// Belongs to a single tenant Organization.
/// </summary>
public class User : IAuditable
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public Guid OrganizationId { get; set; }
    
    public string Name { get; set; } = string.Empty;
    
    public string Email { get; set; } = string.Empty;
    
    public string PasswordHash { get; set; } = string.Empty;
    
    public string Role { get; set; } = "L1_ENGINEER"; // ADMIN, CTO, L1_ENGINEER, L2_ENGINEER, L3_ENGINEER
    
    public string CreatedBy { get; set; } = "System";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? ModifiedBy { get; set; }
    public DateTime? ModifiedAt { get; set; }
    
    public bool IsActive { get; set; } = true;

    // Navigation Property
    public Organization? Organization { get; set; }
}

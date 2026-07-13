using System;

namespace SupportPilot.Application.Common.Security;

/// <summary>
/// Scoped container storing the authenticated tenant (Organization) and operator metadata
/// parsed from incoming JWT auth headers.
/// </summary>
public interface ITenantContext
{
    Guid? TenantId { get; set; }
    string? UserRole { get; set; }
    string? UserEmail { get; set; }
    bool IsAuthorized { get; }
}

public class TenantContext : ITenantContext
{
    public Guid? TenantId { get; set; }
    public string? UserRole { get; set; }
    public string? UserEmail { get; set; }

    public bool IsAuthorized => TenantId.HasValue && !string.IsNullOrEmpty(UserRole);
}

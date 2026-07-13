using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using SupportPilot.Application.Common.Interfaces;
using SupportPilot.Application.Common.Security;
using SupportPilot.Domain.Entities;

namespace SupportPilot.Application.Incidents.Commands;

public record CreateIncidentCommand : IRequest<Guid>
{
    public string Title { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public string AppName { get; init; } = string.Empty;
    public string Severity { get; init; } = "MEDIUM";
    public string Source { get; init; } = "Slack";
    public string CustomerName { get; init; } = string.Empty;
    public string CustomerProfile { get; init; } = string.Empty;
}

public class CreateIncidentCommandHandler : IRequestHandler<CreateIncidentCommand, Guid>
{
    private readonly IApplicationDbContext _context;
    private readonly ITenantContext _tenantContext;

    public CreateIncidentCommandHandler(IApplicationDbContext context, ITenantContext tenantContext)
    {
        _context = context;
        _tenantContext = tenantContext;
    }

    public async Task<Guid> Handle(CreateIncidentCommand request, CancellationToken cancellationToken)
    {
        // 1. Tenant Isolation verification
        if (!_tenantContext.TenantId.HasValue)
        {
            throw new UnauthorizedAccessException("Cannot create an incident without a valid tenant context.");
        }

        // 2. Validate user role permissions (e.g. Read-Only cannot spawn incidents)
        if (_tenantContext.UserRole == "READ_ONLY")
        {
            throw new UnauthorizedAccessException("Insufficient permission level: Read-Only operator cannot spawn active outage incidents.");
        }

        // 3. Construct new domain Incident
        var incident = new Incident
        {
            Id = Guid.NewGuid(),
            OrganizationId = _tenantContext.TenantId.Value,
            Title = request.Title,
            Description = request.Description,
            AppName = request.AppName,
            Severity = request.Severity,
            Status = "OPEN",
            Source = request.Source,
            CustomerName = request.CustomerName,
            CustomerProfile = request.CustomerProfile,
            CreatedAt = DateTime.UtcNow,
            SlaLimitMins = request.Severity == "CRITICAL" ? 15 : (request.Severity == "HIGH" ? 30 : 60)
        };

        _context.Incidents.Add(incident);

        // 4. Record enterprise audit log entry inside same transaction context
        var audit = new AuditLog
        {
            Id = Guid.NewGuid(),
            OrganizationId = _tenantContext.TenantId.Value,
            Operator = _tenantContext.UserEmail ?? "AI_SYSTEM",
            Action = $"INCIDENT_CREATED",
            Module = "Incident Manager",
            Status = "SUCCESS",
            Payload = $"{{\"IncidentId\":\"{incident.Id}\", \"Title\":\"{incident.Title}\"}}",
            Timestamp = DateTime.UtcNow
        };

        _context.AuditLogs.Add(audit);

        await _context.SaveChangesAsync(cancellationToken);

        // 5. Return newly provisioned ID
        return incident.Id;
    }
}

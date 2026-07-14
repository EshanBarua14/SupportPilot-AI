using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SupportPilot.Application.Common.Interfaces;
using SupportPilot.Application.Common.Security;
using SupportPilot.Domain.Entities;

namespace SupportPilot.Application.Incidents.Commands;

public record UpdateIncidentStatusCommand(Guid IncidentId, string Status) : IRequest<bool>;

public class UpdateIncidentStatusCommandHandler : IRequestHandler<UpdateIncidentStatusCommand, bool>
{
    private readonly IApplicationDbContext _context;
    private readonly ITenantContext _tenantContext;

    public UpdateIncidentStatusCommandHandler(IApplicationDbContext context, ITenantContext tenantContext)
    {
        _context = context;
        _tenantContext = tenantContext;
    }

    public async Task<bool> Handle(UpdateIncidentStatusCommand request, CancellationToken cancellationToken)
    {
        if (!_tenantContext.TenantId.HasValue)
        {
            throw new UnauthorizedAccessException("Unauthorized tenant context.");
        }

        // Validate user role permissions
        if (_tenantContext.UserRole == "READ_ONLY")
        {
            throw new UnauthorizedAccessException("Insufficient permission level: Read-Only operators cannot alter incident statuses.");
        }

        var incident = await _context.Incidents
            .FirstOrDefaultAsync(i => i.Id == request.IncidentId && i.OrganizationId == _tenantContext.TenantId.Value, cancellationToken);

        if (incident == null)
        {
            return false;
        }

        incident.Status = request.Status;
        if (request.Status.Equals("SOLVED", StringComparison.OrdinalIgnoreCase))
        {
            incident.ResolvedAt = DateTime.UtcNow;
        }

        var audit = new AuditLog
        {
            Id = Guid.NewGuid(),
            OrganizationId = _tenantContext.TenantId.Value,
            Operator = _tenantContext.UserEmail ?? "AI_SYSTEM",
            Action = "INCIDENT_STATUS_UPDATED",
            Module = "Incident Manager",
            Status = "SUCCESS",
            Payload = $"{{\"IncidentId\":\"{incident.Id}\", \"Status\":\"{request.Status}\"}}",
            Timestamp = DateTime.UtcNow
        };

        _context.AuditLogs.Add(audit);
        await _context.SaveChangesAsync(cancellationToken);

        return true;
    }
}

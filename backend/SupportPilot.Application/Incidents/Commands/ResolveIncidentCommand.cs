using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SupportPilot.Application.Common.Interfaces;
using SupportPilot.Application.Common.Security;
using SupportPilot.Domain.Entities;

namespace SupportPilot.Application.Incidents.Commands;

public record ResolveIncidentCommand(Guid IncidentId) : IRequest<bool>;

public class ResolveIncidentCommandHandler : IRequestHandler<ResolveIncidentCommand, bool>
{
    private readonly IApplicationDbContext _context;
    private readonly ITenantContext _tenantContext;

    public ResolveIncidentCommandHandler(IApplicationDbContext context, ITenantContext tenantContext)
    {
        _context = context;
        _tenantContext = tenantContext;
    }

    public async Task<bool> Handle(ResolveIncidentCommand request, CancellationToken cancellationToken)
    {
        if (!_tenantContext.TenantId.HasValue)
        {
            throw new UnauthorizedAccessException("Unauthorized tenant context.");
        }

        // Isolate retrieval using tenant ID parameter (strict tenant security query boundary)
        var incident = await _context.Incidents
            .FirstOrDefaultAsync(i => i.Id == request.IncidentId && i.OrganizationId == _tenantContext.TenantId.Value, cancellationToken);

        if (incident == null)
        {
            return false; // Incident not found within tenant boundary
        }

        // Set status to SOLVED
        incident.Status = "SOLVED";
        incident.ResolvedAt = DateTime.UtcNow;

        var audit = new AuditLog
        {
            Id = Guid.NewGuid(),
            OrganizationId = _tenantContext.TenantId.Value,
            Operator = _tenantContext.UserEmail ?? "AI_SYSTEM",
            Action = "INCIDENT_RESOLVED",
            Module = "Incident Manager",
            Status = "SUCCESS",
            Payload = $"{{\"IncidentId\":\"{incident.Id}\", \"Status\":\"SOLVED\"}}",
            Timestamp = DateTime.UtcNow
        };

        _context.AuditLogs.Add(audit);
        await _context.SaveChangesAsync(cancellationToken);

        return true;
    }
}

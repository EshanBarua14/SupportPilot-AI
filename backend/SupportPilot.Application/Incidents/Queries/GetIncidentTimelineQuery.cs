using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SupportPilot.Application.Common.Interfaces;
using SupportPilot.Application.Common.Security;

namespace SupportPilot.Application.Incidents.Queries;

public record GetIncidentTimelineQuery(Guid IncidentId) : IRequest<List<TimelineEventDto>>;

public record TimelineEventDto(
    Guid Id,
    string Operator,
    string Action,
    string Module,
    string Status,
    string Payload,
    DateTime Timestamp
);

public class GetIncidentTimelineQueryHandler : IRequestHandler<GetIncidentTimelineQuery, List<TimelineEventDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ITenantContext _tenantContext;

    public GetIncidentTimelineQueryHandler(IApplicationDbContext context, ITenantContext tenantContext)
    {
        _context = context;
        _tenantContext = tenantContext;
    }

    public async Task<List<TimelineEventDto>> Handle(GetIncidentTimelineQuery request, CancellationToken cancellationToken)
    {
        if (!_tenantContext.TenantId.HasValue)
        {
            throw new UnauthorizedAccessException("Tenant verification failure.");
        }

        var incidentIdStr = request.IncidentId.ToString();

        // Query the audit logs belonging to the active tenant where the payload contains the incident ID
        var logs = await _context.AuditLogs
            .AsNoTracking()
            .Where(l => l.OrganizationId == _tenantContext.TenantId.Value && l.Payload.Contains(incidentIdStr))
            .OrderBy(l => l.Timestamp)
            .Select(l => new TimelineEventDto(
                l.Id,
                l.Operator,
                l.Action,
                l.Module,
                l.Status,
                l.Payload,
                l.Timestamp
            ))
            .ToListAsync(cancellationToken);

        return logs;
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SupportPilot.Application.Common.Interfaces;
using SupportPilot.Application.Common.Security;
using SupportPilot.Domain.Entities;

namespace SupportPilot.Application.Incidents.Queries;

public record GetIncidentsQuery : IRequest<List<IncidentDto>>
{
    public string? StatusFilter { get; init; }
    public string? SeverityFilter { get; init; }
}

public record IncidentDto(
    Guid Id,
    string Title,
    string Description,
    string AppName,
    string Severity,
    string Status,
    string Assignee,
    string Source,
    string CustomerName,
    DateTime CreatedAt,
    int SlaLimitMins
);

public class GetIncidentsQueryHandler : IRequestHandler<GetIncidentsQuery, List<IncidentDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ITenantContext _tenantContext;

    public GetIncidentsQueryHandler(IApplicationDbContext context, ITenantContext tenantContext)
    {
        _context = context;
        _tenantContext = tenantContext;
    }

    public async Task<List<IncidentDto>> Handle(GetIncidentsQuery request, CancellationToken cancellationToken)
    {
        if (!_tenantContext.TenantId.HasValue)
        {
            throw new UnauthorizedAccessException("Tenant identity missing.");
        }

        // Apply strict tenant filter on EF Core query
        var query = _context.Incidents
            .AsNoTracking()
            .Where(i => i.OrganizationId == _tenantContext.TenantId.Value);

        if (!string.IsNullOrEmpty(request.StatusFilter))
        {
            query = query.Where(i => i.Status == request.StatusFilter);
        }

        if (!string.IsNullOrEmpty(request.SeverityFilter))
        {
            query = query.Where(i => i.Severity == request.SeverityFilter);
        }

        return await query
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new IncidentDto(
                i.Id,
                i.Title,
                i.Description,
                i.AppName,
                i.Severity,
                i.Status,
                i.Assignee,
                i.Source,
                i.CustomerName,
                i.CreatedAt,
                i.SlaLimitMins
            ))
            .ToListAsync(cancellationToken);
    }
}

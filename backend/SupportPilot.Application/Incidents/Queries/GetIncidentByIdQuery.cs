using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SupportPilot.Application.Common.Interfaces;
using SupportPilot.Application.Common.Security;
using SupportPilot.Domain.Entities;

namespace SupportPilot.Application.Incidents.Queries;

public record GetIncidentByIdQuery(Guid Id) : IRequest<IncidentDetailsDto?>;

public record IncidentDetailsDto(
    Guid Id,
    Guid OrganizationId,
    string Title,
    string Description,
    string AppName,
    string Severity,
    string Status,
    string Assignee,
    string Source,
    string CustomerName,
    string CustomerProfile,
    int SlaLimitMins,
    DateTime CreatedAt,
    string LogsJson,
    string MetricsJson,
    string TracesJson,
    string DbStateJson,
    string? AiAnalysisJson,
    string? CustomerDraftReply
);

public class GetIncidentByIdQueryHandler : IRequestHandler<GetIncidentByIdQuery, IncidentDetailsDto?>
{
    private readonly IApplicationDbContext _context;
    private readonly ITenantContext _tenantContext;

    public GetIncidentByIdQueryHandler(IApplicationDbContext context, ITenantContext tenantContext)
    {
        _context = context;
        _tenantContext = tenantContext;
    }

    public async Task<IncidentDetailsDto?> Handle(GetIncidentByIdQuery request, CancellationToken cancellationToken)
    {
        if (!_tenantContext.TenantId.HasValue)
        {
            throw new UnauthorizedAccessException("Tenant verification failure.");
        }

        // Query filtering by both primary key and active tenant identifier for strict access containment
        var i = await _context.Incidents
            .AsNoTracking()
            .FirstOrDefaultAsync(inc => inc.Id == request.Id && inc.OrganizationId == _tenantContext.TenantId.Value, cancellationToken);

        if (i == null)
        {
            return null;
        }

        return new IncidentDetailsDto(
            i.Id,
            i.OrganizationId,
            i.Title,
            i.Description,
            i.AppName,
            i.Severity,
            i.Status,
            i.Assignee,
            i.Source,
            i.CustomerName,
            i.CustomerProfile,
            i.SlaLimitMins,
            i.CreatedAt,
            i.LogsJson,
            i.MetricsJson,
            i.TracesJson,
            i.DbStateJson,
            i.AiAnalysisJson,
            i.CustomerDraftReply
        );
    }
}

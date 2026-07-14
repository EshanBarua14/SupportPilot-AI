using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SupportPilot.Application.Common.Interfaces;
using SupportPilot.Application.Common.Security;
using SupportPilot.Domain.Entities;

namespace SupportPilot.Application.Incidents.Commands;

public record AttachDiagnosticDataCommand(
    Guid IncidentId, 
    string DataType, // logs, metrics, traces, dbState
    string JsonData
) : IRequest<bool>;

public class AttachDiagnosticDataCommandHandler : IRequestHandler<AttachDiagnosticDataCommand, bool>
{
    private readonly IApplicationDbContext _context;
    private readonly ITenantContext _tenantContext;

    public AttachDiagnosticDataCommandHandler(IApplicationDbContext context, ITenantContext tenantContext)
    {
        _context = context;
        _tenantContext = tenantContext;
    }

    public async Task<bool> Handle(AttachDiagnosticDataCommand request, CancellationToken cancellationToken)
    {
        if (!_tenantContext.TenantId.HasValue)
        {
            throw new UnauthorizedAccessException("Tenant identity missing.");
        }

        var incident = await _context.Incidents
            .FirstOrDefaultAsync(i => i.Id == request.IncidentId && i.OrganizationId == _tenantContext.TenantId.Value, cancellationToken);

        if (incident == null)
        {
            return false;
        }

        switch (request.DataType.ToLower())
        {
            case "logs":
                incident.LogsJson = request.JsonData;
                break;
            case "metrics":
                incident.MetricsJson = request.JsonData;
                break;
            case "traces":
                incident.TracesJson = request.JsonData;
                break;
            case "db":
            case "dbstate":
                incident.DbStateJson = request.JsonData;
                break;
            default:
                throw new ArgumentException($"Unsupported diagnostic data type: {request.DataType}");
        }

        var audit = new AuditLog
        {
            Id = Guid.NewGuid(),
            OrganizationId = _tenantContext.TenantId.Value,
            Operator = _tenantContext.UserEmail ?? "DIAGNOSTIC_BOT",
            Action = $"DIAGNOSTIC_DATA_ATTACHED",
            Module = "Telemetry Engine",
            Status = "SUCCESS",
            Payload = $"{{\"IncidentId\":\"{incident.Id}\", \"DataType\":\"{request.DataType}\"}}",
            Timestamp = DateTime.UtcNow
        };

        _context.AuditLogs.Add(audit);
        await _context.SaveChangesAsync(cancellationToken);

        return true;
    }
}

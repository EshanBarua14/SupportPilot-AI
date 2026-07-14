using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using SupportPilot.Application.Common.Security;
using SupportPilot.Application.Incidents.Commands;
using SupportPilot.Application.Incidents.Queries;
using SupportPilot.Infrastructure.Hubs;
using SupportPilot.Infrastructure.Security;

namespace SupportPilot.API.Controllers;

[Authorize]
[ApiController]
[Route("api/incidents")]
public class IncidentsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IHubContext<IncidentHub, IIncidentClient> _hubContext;
    private readonly ITenantContext _tenantContext;

    public IncidentsController(
        IMediator mediator, 
        IHubContext<IncidentHub, IIncidentClient> hubContext,
        ITenantContext tenantContext)
    {
        _mediator = mediator;
        _hubContext = hubContext;
        _tenantContext = tenantContext;
    }

    /// <summary>
    /// Gets all incidents. Uses CQRS query isolated to active tenant context.
    /// </summary>
    [HttpGet]
    [HasPermission("READ_ONLY")]
    public async Task<ActionResult<List<IncidentDto>>> GetIncidents([FromQuery] string? status, [FromQuery] string? severity)
    {
        var query = new GetIncidentsQuery
        {
            StatusFilter = status,
            SeverityFilter = severity
        };

        var result = await _mediator.Send(query);
        return Ok(result);
    }

    /// <summary>
    /// Gets a single incident by ID within active tenant boundary.
    /// </summary>
    [HttpGet("{id:guid}")]
    [HasPermission("READ_ONLY")]
    public async Task<ActionResult<IncidentDetailsDto>> GetIncidentById(Guid id)
    {
        var result = await _mediator.Send(new GetIncidentByIdQuery(id));
        
        if (result == null)
        {
            return NotFound(new { Message = "Incident not found in the current tenant authorization scope." });
        }

        return Ok(result);
    }

    /// <summary>
    /// Creates a new Incident and broadcasts the event live via SignalR.
    /// </summary>
    [HttpPost]
    [HasPermission("L1_ENGINEER")]
    public async Task<ActionResult<Guid>> CreateIncident([FromBody] CreateIncidentCommand command)
    {
        // Execute Command via MediatR pipeline
        Guid incidentId = await _mediator.Send(command);

        // Fetch details to push over real-time SignalR socket
        var incidentDetails = await _mediator.Send(new GetIncidentByIdQuery(incidentId));

        if (incidentDetails != null)
        {
            string groupName = $"Tenant-{_tenantContext.TenantId}";
            
            // Push real-time SignalR event to only this tenant group
            await _hubContext.Clients.Group(groupName).ReceiveIncidentUpdate("CREATED", incidentDetails);
            
            // Broadcast a high-priority system-alert regarding critical outages
            if (incidentDetails.Severity == "CRITICAL" || incidentDetails.Severity == "HIGH")
            {
                await _hubContext.Clients.Group(groupName).ReceiveSystemAlert(new
                {
                    Type = "CRITICAL_ALERT",
                    Message = $"Critical alert triggered: '{incidentDetails.Title}' in application '{incidentDetails.AppName}'",
                    Severity = incidentDetails.Severity,
                    IncidentId = incidentDetails.Id,
                    Timestamp = DateTime.UtcNow
                });
            }
        }

        return CreatedAtAction(nameof(GetIncidentById), new { id = incidentId }, incidentId);
    }

    /// <summary>
    /// Resolves an incident, updating statuses and broadcasting state over sockets.
    /// </summary>
    [HttpPost("{id:guid}/resolve")]
    [HasPermission("ADMIN")]
    public async Task<IActionResult> ResolveIncident(Guid id)
    {
        var command = new ResolveIncidentCommand(id);
        bool success = await _mediator.Send(command);

        if (!success)
        {
            return BadRequest(new { Message = "Incident not found or could not be resolved." });
        }

        string groupName = $"Tenant-{_tenantContext.TenantId}";
        await _hubContext.Clients.Group(groupName).ReceiveIncidentUpdate("RESOLVED", new { IncidentId = id, Status = "SOLVED" });

        return Ok(new { Success = true, Message = "Incident status updated to SOLVED." });
    }

    /// <summary>
    /// Updates the status of an incident and broadcasts the update via SignalR.
    /// </summary>
    [HttpPost("{id:guid}/status")]
    [HasPermission("L1_ENGINEER")]
    public async Task<IActionResult> UpdateIncidentStatus(Guid id, [FromBody] UpdateStatusRequest request)
    {
        var command = new UpdateIncidentStatusCommand(id, request.Status);
        bool success = await _mediator.Send(command);

        if (!success)
        {
            return BadRequest(new { Message = "Incident not found or could not be updated." });
        }

        string groupName = $"Tenant-{_tenantContext.TenantId}";
        await _hubContext.Clients.Group(groupName).ReceiveIncidentUpdate("STATUS_UPDATED", new { IncidentId = id, Status = request.Status });

        return Ok(new { Success = true, Message = $"Incident status updated to {request.Status}." });
    }

    /// <summary>
    /// Fetches the audit log timeline for a specific incident.
    /// </summary>
    [HttpGet("{id:guid}/timeline")]
    [HasPermission("READ_ONLY")]
    public async Task<ActionResult<List<TimelineEventDto>>> GetIncidentTimeline(Guid id)
    {
        var query = new GetIncidentTimelineQuery(id);
        var result = await _mediator.Send(query);
        return Ok(result);
    }

    /// <summary>
    /// Attaches diagnostic telemetry or state logs to an incident.
    /// </summary>
    [HttpPost("{id:guid}/diagnostics")]
    [HasPermission("L1_ENGINEER")]
    public async Task<IActionResult> AttachDiagnosticData(Guid id, [FromBody] AttachDiagnosticRequest request)
    {
        var command = new AttachDiagnosticDataCommand(id, request.DataType, request.JsonData);
        bool success = await _mediator.Send(command);

        if (!success)
        {
            return BadRequest(new { Message = "Incident not found or diagnostics could not be attached." });
        }

        return Ok(new { Success = true, Message = "Diagnostic telemetry successfully attached." });
    }
}

public class UpdateStatusRequest
{
    public string Status { get; set; } = string.Empty;
}

public class AttachDiagnosticRequest
{
    public string DataType { get; set; } = string.Empty;
    public string JsonData { get; set; } = string.Empty;
}

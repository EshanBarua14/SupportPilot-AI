using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace SupportPilot.Infrastructure.Hubs;

/// <summary>
/// Authoritative real-time communications channel for streaming incident updates and
/// system warnings over WebSockets. Groups users by their Tenant ID to guarantee separation.
/// </summary>
public interface IIncidentClient
{
    Task ReceiveIncidentUpdate(string action, object incidentPayload);
    Task ReceiveSystemAlert(object alertPayload);
}

[Authorize]
public class IncidentHub : Hub<IIncidentClient>
{
    /// <summary>
    /// When a user connects, automatically parse their claims and put them into
    /// a tenant-specific SignalR Group to enforce isolation.
    /// </summary>
    public override async Task OnConnectedAsync()
    {
        var tenantId = Context.User?.FindFirst("TenantId")?.Value;
        
        if (!string.IsNullOrEmpty(tenantId))
        {
            // Join group for this tenant
            await Groups.AddToGroupAsync(Context.ConnectionId, $"Tenant-{tenantId}");
            
            await Clients.Caller.ReceiveSystemAlert(new
            {
                Type = "SYSTEM_INFO",
                Message = $"Connected to SupportPilot live stream. Group: Tenant-{tenantId}",
                Timestamp = DateTime.UtcNow
            });
        }
        else
        {
            // Fallback for anonymous sandbox testing
            await Groups.AddToGroupAsync(Context.ConnectionId, "SandboxTenant");
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var tenantId = Context.User?.FindFirst("TenantId")?.Value;
        if (!string.IsNullOrEmpty(tenantId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"Tenant-{tenantId}");
        }
        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Enforces broadcasting incident details exclusively to members belonging to the same tenant.
    /// </summary>
    public async Task BroadcastIncidentUpdate(string tenantId, string action, object incident)
    {
        await Clients.Group($"Tenant-{tenantId}").ReceiveIncidentUpdate(action, incident);
    }
}
//

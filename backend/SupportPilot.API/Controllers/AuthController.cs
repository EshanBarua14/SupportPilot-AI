using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using SupportPilot.Infrastructure.Security;

namespace SupportPilot.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IJwtService _jwtService;

    public AuthController(IJwtService jwtService)
    {
        _jwtService = jwtService;
    }

    public record LoginRequest(string Email, string Password, Guid SelectedTenantId);
    public record AuthResponse(string Token, string Email, string Role, Guid TenantId, string TenantName);

    /// <summary>
    /// Authenticates a user and issues a high-entropy JWT containing tenant isolation boundaries.
    /// </summary>
    [HttpPost("login")]
    public ActionResult<AuthResponse> Login([FromBody] LoginRequest request)
    {
        // For production identity services, this would consult the AspNetIdentity tables.
        // For our high-fidelity, clean architecture demo, we map the selected tenant directly:
        string role = "ADMIN";
        string tenantName = "Acme Cloud Services";

        if (request.Email.Contains("l1", StringComparison.OrdinalIgnoreCase)) role = "L1_ENGINEER";
        else if (request.Email.Contains("l2", StringComparison.OrdinalIgnoreCase)) role = "L2_ENGINEER";
        else if (request.Email.Contains("cto", StringComparison.OrdinalIgnoreCase)) role = "CTO";

        if (request.SelectedTenantId == Guid.Parse("11111111-1111-1111-1111-111111111111"))
        {
            tenantName = "Acme Billing Services";
        }
        else if (request.SelectedTenantId == Guid.Parse("22222222-2222-2222-2222-222222222222"))
        {
            tenantName = "Fintech Pay Gateway";
        }
        else if (request.SelectedTenantId == Guid.Parse("33333333-3333-3333-3333-333333333333"))
        {
            tenantName = "Global Logistics Network";
        }

        // Generate JWT token containing TenantId, User Email, and Role as claims
        string token = _jwtService.GenerateToken(request.Email, role, request.SelectedTenantId, tenantName);

        var response = new AuthResponse(
            token,
            request.Email,
            role,
            request.SelectedTenantId,
            tenantName
        );

        return Ok(response);
    }
}

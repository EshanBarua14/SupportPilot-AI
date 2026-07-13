using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;
using SupportPilot.Application.Common.Security;

namespace SupportPilot.Infrastructure.Security;

/// <summary>
/// Custom ASP.NET Core Action Filter that intercepts incoming requests and validates
/// the authenticated operator's JWT role claim against multi-tenant permission layers.
/// </summary>
public class TenantPermissionFilter : IAsyncActionFilter
{
    private readonly string _requiredRole;

    public TenantPermissionFilter(string requiredRole)
    {
        _requiredRole = requiredRole;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var tenantContext = context.HttpContext.RequestServices.GetRequiredService<ITenantContext>();

        if (!tenantContext.TenantId.HasValue)
        {
            context.Result = new UnauthorizedObjectResult(new { Message = "Access Denied: Tenant context is not hydrated." });
            return;
        }

        // Parse user role from JWT claims hydrated context
        string currentRole = tenantContext.UserRole ?? "READ_ONLY";

        bool isAuthorized = false;

        // RBAC Hierarchy
        if (currentRole == "CTO")
        {
            // CTO has full system authorization access
            isAuthorized = true;
        }
        else if (currentRole == "ADMIN")
        {
            // ADMIN has standard write/admin privilege
            isAuthorized = (_requiredRole == "ADMIN" || _requiredRole == "L2_ENGINEER" || _requiredRole == "L1_ENGINEER" || _requiredRole == "READ_ONLY");
        }
        else if (currentRole == "L2_ENGINEER")
        {
            isAuthorized = (_requiredRole == "L2_ENGINEER" || _requiredRole == "L1_ENGINEER" || _requiredRole == "READ_ONLY");
        }
        else if (currentRole == "L1_ENGINEER")
        {
            isAuthorized = (_requiredRole == "L1_ENGINEER" || _requiredRole == "READ_ONLY");
        }
        else if (currentRole == "READ_ONLY")
        {
            isAuthorized = (_requiredRole == "READ_ONLY");
        }

        if (!isAuthorized)
        {
            context.Result = new ObjectResult(new { 
                Message = $"Forbidden: Required security scope '{_requiredRole}' is not satisfied by the current operator role '{currentRole}' in tenant context." 
            })
            {
                StatusCode = 403
            };
            return;
        }

        await next();
    }
}

/// <summary>
/// Restricts action access to users containing specific RBAC role hierarchies.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public class HasPermissionAttribute : TypeFilterAttribute
{
    public HasPermissionAttribute(string requiredRole) : base(typeof(TenantPermissionFilter))
    {
        Arguments = new object[] { requiredRole };
    }
}

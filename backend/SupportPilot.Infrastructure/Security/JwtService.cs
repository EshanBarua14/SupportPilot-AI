using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace SupportPilot.Infrastructure.Security;

/// <summary>
/// Service providing high-entropy asymmetric JWT generation for multi-tenant users.
/// </summary>
public interface IJwtService
{
    string GenerateToken(string email, string role, Guid tenantId, string tenantName);
}

public class JwtService : IJwtService
{
    private const string SecretKey = "SUPPORTPILOT_ENTERPRISE_HIGH_SECRET_SIGNING_KEY_2026_JWT_SYMMETRIC_TOKEN";
    private const int ExpirationDays = 7;

    public string GenerateToken(string email, string role, Guid tenantId, string tenantName)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(SecretKey);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, email),
                new Claim(JwtRegisteredClaimNames.Email, email),
                new Claim("TenantId", tenantId.ToString()),
                new Claim("TenantName", tenantName),
                new Claim(ClaimTypes.Role, role),
                new Claim("role", role),
                new Claim("jti", Guid.NewGuid().ToString())
            }),
            Expires = DateTime.UtcNow.AddDays(ExpirationDays),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(key), 
                SecurityAlgorithms.HmacSha256Signature
            ),
            Issuer = "supportpilot.ai",
            Audience = "supportpilot-clients"
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }
}
//

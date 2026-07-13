using System;
using System.Text;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using SupportPilot.Application.Common.Interfaces;
using SupportPilot.Application.Common.Security;
using SupportPilot.Application.Incidents.Commands;
using SupportPilot.Infrastructure.Hubs;
using SupportPilot.Infrastructure.Persistence;
using SupportPilot.Infrastructure.Security;

var builder = WebApplication.CreateBuilder(args);

// -------------------------------------------------------------
// 1. CONFIGURE SERVICES (DEPENDENCY INJECTION)
// -------------------------------------------------------------

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// Swagger Documentation with JWT Security Scheme Definition
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo 
    { 
        Title = "SupportPilot Enterprise API Engine", 
        Version = "v9.0.0",
        Description = "ASP.NET Core 9 Clean Architecture Multi-Tenant Backend with CQRS, SignalR, and PostgreSQL pgvector compatibility."
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter your high-entropy SupportPilot JWT Bearer token: Bearer {token}"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

// Relational DB Connection (PostgreSQL)
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
                       ?? "Host=localhost;Database=SupportPilotDb;Username=postgres;Password=postgres";

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString, b => b.MigrationsAssembly("SupportPilot.Infrastructure")));

// Map interfaces to DbContext
builder.Services.AddScoped<IApplicationDbContext>(provider => provider.GetRequiredService<ApplicationDbContext>());

// Scoped Tenant Isolation Context
builder.Services.AddScoped<ITenantContext, TenantContext>();

// JWT Symmetric Signer Key configurations
builder.Services.AddSingleton<IJwtService, JwtService>();

// Register MediatR library for CQRS Commands & Queries pipeline
builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(CreateIncidentCommand).Assembly));

// Register Real-time SignalR hubs
builder.Services.AddSignalR();

// Configure Authentication using Bearer JWT tokens
const string secretKey = "SUPPORTPILOT_ENTERPRISE_HIGH_SECRET_SIGNING_KEY_2026_JWT_SYMMETRIC_TOKEN";
var key = Encoding.UTF8.GetBytes(secretKey);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = true,
        ValidIssuer = "supportpilot.ai",
        ValidateAudience = true,
        ValidAudience = "supportpilot-clients",
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromMinutes(5)
    };
});

// Configure CORS for local development inside container iframe
builder.Services.AddCors(options =>
{
    options.AddPolicy("SupportPilotCorsPolicy", policy =>
    {
        policy.AllowAnyHeader()
              .AllowAnyMethod()
              .SetIsOriginAllowed(_ => true) // Matches development local proxy configurations
              .AllowCredentials();
        policy.WithExposedHeaders("X-Tenant-ID", "X-Operator-Role");
    });
});

var app = builder.Build();

// -------------------------------------------------------------
// 2. CONFIGURE HTTP REQUEST PIPELINE (MIDDLEWARES)
// -------------------------------------------------------------

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "SupportPilot API v1");
    });
}

app.UseCors("SupportPilotCorsPolicy");

// Custom Tenant Extraction Middleware (extracts Tenant GUID and Role claims)
app.UseMiddleware<TenantMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Map SignalR Real-Time Incident Stream Hub
app.MapHub<IncidentHub>("/hub/incidents");

// Run seed data on development startup if required
using (var scope = app.Services.CreateScope())
{
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Database.EnsureCreated(); // Ensure DB tables mapped beautifully on startup
    }
    catch (Exception ex)
    {
        Console.WriteLine($"DB Initial seeding failed: {ex.Message}");
    }
}

app.Run();

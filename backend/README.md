# SupportPilot AI Enterprise Core Backend

Welcome to the **SupportPilot AI** core backend system. This folder contains the enterprise-grade ASP.NET Core 9 Clean Architecture implementation, designed to manage high-throughput telemetry streams, AI investigation queues, and multi-tenant incident isolation.

## 🏛️ Clean Architecture Breakdown

The project follows standard Domain-Driven Design (DDD) and Clean Architecture layout patterns:

1. **SupportPilot.Domain**
   - Core enterprise entities: `Organization` (Tenant boundaries), `User` (RBAC accounts), `Incident` (Tickets with telemetry), and `AuditLog` (Immutable logs).
   - Zero external library dependencies (completely clean and independent of database or HTTP frameworks).

2. **SupportPilot.Application**
   - Implements CQRS (Command Query Responsibility Segregation) patterns via **MediatR**.
   - Contains Commands (e.g., `CreateIncidentCommand`, `ResolveIncidentCommand`) and Queries (e.g., `GetIncidentsQuery`).
   - Defines persistence interfaces like `IApplicationDbContext`.
   - Enforces user role boundary checks on operational requests.

3. **SupportPilot.Infrastructure**
   - **Persistence**: Implements `ApplicationDbContext` mapped to PostgreSQL, with specific configurations for JSON storage columns (`jsonb` maps logs, metrics series, and traces directly).
   - **Security**: Contains `JwtService` (token claims manager generating high-entropy symmetric JWT signatures) and `TenantMiddleware` (parses sub, email, and TenantId claims to hydrate the scoped `TenantContext` safely on every request).
   - **Hubs**: Implements the typed SignalR `IncidentHub` using authorized multi-tenant Group subscriptions to prevent cross-tenant message leakages.

4. **SupportPilot.API**
   - Entry point controller actions (`AuthController`, `IncidentsController`).
   - Configures the dependency injection container, JWT authentication guards, Swagger generation schemas, and CORS policies inside `Program.cs`.

---

## 🚀 Getting Started

### Prerequisites
- .NET SDK 9.0+
- PostgreSQL Instance (or Docker Compose container)

### Configuration
Update the PostgreSQL connection string inside `/backend/SupportPilot.API/appsettings.json`:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=127.0.0.1;Port=5432;Database=SupportPilotDb;Username=postgres;Password=your_password;SSL Mode=Prefer"
  }
}
```

### Build & Run
To run the web API project:
```bash
# Navigate to API project
cd SupportPilot.API

# Run and build project
dotnet run
```
Once launched, browse to `http://localhost:5000/swagger` to inspect the Swagger API Playground, authorize via Bearer JWT claims, and run live multi-tenant tests.

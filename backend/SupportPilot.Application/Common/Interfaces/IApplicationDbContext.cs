using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using SupportPilot.Domain.Entities;

namespace SupportPilot.Application.Common.Interfaces;

/// <summary>
/// Clean Architecture contract exposing Entity Framework sets to the application layer.
/// </summary>
public interface IApplicationDbContext
{
    DbSet<Organization> Organizations { get; }
    DbSet<User> Users { get; }
    DbSet<Incident> Incidents { get; }
    DbSet<AuditLog> AuditLogs { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}

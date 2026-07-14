using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using SupportPilot.Application.Common.Interfaces;
using SupportPilot.Application.Common.Security;
using SupportPilot.Domain.Entities;

namespace SupportPilot.Infrastructure.Persistence;

/// <summary>
/// Entity Framework Core database context representing the operational PostgreSQL instance.
/// Implements DB-level multi-tenant configurations.
/// </summary>
public class ApplicationDbContext : DbContext, IApplicationDbContext
{
    private readonly ITenantContext? _tenantContext;

    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options,
        ITenantContext? tenantContext = null) : base(options)
    {
        _tenantContext = tenantContext;
    }

    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Incident> Incidents => Set<Incident>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // 1. Organization Configuration
        modelBuilder.Entity<Organization>(entity =>
        {
            entity.ToTable("Organizations");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(150);
            entity.HasIndex(e => e.Name).IsUnique();
        });

        // 2. User Configuration with strict RBAC index
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("Users");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(250);
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.Role).IsRequired().HasMaxLength(50);
            
            // Multi-tenant Relationship
            entity.HasOne(e => e.Organization)
                .WithMany(o => o.Users)
                .HasForeignKey(e => e.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasQueryFilter(e => _tenantContext == null || !_tenantContext.TenantId.HasValue || e.OrganizationId == _tenantContext.TenantId.Value);
        });

        // 3. Incident Configuration with Multi-tenant indexing
        modelBuilder.Entity<Incident>(entity =>
        {
            entity.ToTable("Incidents");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Title).IsRequired().HasMaxLength(250);
            entity.Property(e => e.Severity).IsRequired().HasMaxLength(20);
            entity.Property(e => e.Status).IsRequired().HasMaxLength(20);

            // Foreign Key and Tenant Index for isolated quick query resolution
            entity.HasIndex(e => new { e.OrganizationId, e.Status });
            entity.HasIndex(e => new { e.OrganizationId, e.Severity });

            entity.HasOne(e => e.Organization)
                .WithMany(o => o.Incidents)
                .HasForeignKey(e => e.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);

            // Configure JSON columns to map nicely into PostgreSQL jsonb
            entity.Property(e => e.LogsJson).HasColumnType("jsonb");
            entity.Property(e => e.MetricsJson).HasColumnType("jsonb");
            entity.Property(e => e.TracesJson).HasColumnType("jsonb");
            entity.Property(e => e.DbStateJson).HasColumnType("jsonb");
            entity.Property(e => e.ApiCallsJson).HasColumnType("jsonb");
            entity.Property(e => e.QueueStateJson).HasColumnType("jsonb");
            entity.Property(e => e.AiAnalysisJson).HasColumnType("jsonb");

            entity.HasQueryFilter(e => _tenantContext == null || !_tenantContext.TenantId.HasValue || e.OrganizationId == _tenantContext.TenantId.Value);
        });

        // 4. Audit Log Configuration
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("AuditLogs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Operator).IsRequired().HasMaxLength(150);
            entity.Property(e => e.Action).IsRequired().HasMaxLength(150);
            entity.Property(e => e.Module).IsRequired().HasMaxLength(100);

            entity.HasIndex(e => e.OrganizationId);

            entity.HasOne(e => e.Organization)
                .WithMany(o => o.AuditLogs)
                .HasForeignKey(e => e.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.Property(e => e.Payload).HasColumnType("jsonb");

            entity.HasQueryFilter(e => _tenantContext == null || !_tenantContext.TenantId.HasValue || e.OrganizationId == _tenantContext.TenantId.Value);
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var currentUser = _tenantContext?.UserEmail ?? "System";
        var now = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<IAuditable>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedBy = currentUser;
                entry.Entity.CreatedAt = now;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.ModifiedBy = currentUser;
                entry.Entity.ModifiedAt = now;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}

using CareSlot.Application.Common.Interfaces;
using CareSlot.Domain.Entities;
using CareSlot.Infrastructure.Persistence.Converters;
using Microsoft.EntityFrameworkCore;

namespace CareSlot.Infrastructure.Persistence;

public class CareSlotDbContext : DbContext
{
    private readonly IEncryptionService _encryptionService;

    public CareSlotDbContext(
        DbContextOptions<CareSlotDbContext> options,
        IEncryptionService encryptionService
    ) : base(options) {
            _encryptionService = encryptionService;
        }

    public DbSet<Doctor> Doctors => Set<Doctor>();
    public DbSet<DoctorSlot> DoctorSlots => Set<DoctorSlot>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        var encryptionConverter = new AesEncryptionConverter(_encryptionService);

        // -------------------------------------------------------------
        // 1. Doctor Configuration
        // -------------------------------------------------------------
        modelBuilder.Entity<Doctor>(entity =>
        {
            entity.HasKey(d => d.Id);
            entity.Property(d => d.Name).IsRequired().HasMaxLength(150);
            entity.Property(d => d.Specialty).IsRequired().HasMaxLength(100);

            // Seed initial sample doctors for quick testing
            entity.HasData(
                new Doctor { Id = Guid.Parse("11111111-1111-1111-1111-111111111111"), Name = "Dr. Sarah Jenkins", Specialty = "Cardiology" },
                new Doctor { Id = Guid.Parse("22222222-2222-2222-2222-222222222222"), Name = "Dr. Marcus Chen", Specialty = "Neurology" },
                new Doctor { Id = Guid.Parse("33333333-3333-3333-3333-333333333333"), Name = "Dr. Emily Rodriguez", Specialty = "Pediatrics" }
            );
        });

        // -------------------------------------------------------------
        // 2. DoctorSlot Configuration
        // -------------------------------------------------------------
        modelBuilder.Entity<DoctorSlot>(entity =>
        {
            entity.HasKey(s => s.Id);

            // Relationship with Doctor
            entity.HasOne(s => s.Doctor)
                  .WithMany(d => d.Slots)
                  .HasForeignKey(s => s.DoctorId)
                  .OnDelete(DeleteBehavior.Cascade);

            // Concurrency Token: SQL Server ROWVERSION (prevents race conditions)
            entity.Property(s => s.RowVersion)
                  .IsRowVersion();

            // HIPAA Column Encryption at rest
            entity.Property(s => s.EncryptedNid)
                  .HasConversion(encryptionConverter)
                  .HasMaxLength(500);

            entity.Property(s => s.EncryptedNotes)
                  .HasConversion(encryptionConverter)
                  .HasMaxLength(2000);

            entity.Property(s => s.PatientName)
                  .HasMaxLength(150);

            // Composite Index for fast schedule lookups
            entity.HasIndex(s => new { s.DoctorId, s.StartTime, s.Status });
        });

        // -------------------------------------------------------------
        // 3. AuditLog Configuration
        // -------------------------------------------------------------
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasKey(a => a.Id);
            entity.Property(a => a.UserId).IsRequired().HasMaxLength(100);
            entity.Property(a => a.Action).IsRequired().HasMaxLength(50);
            entity.Property(a => a.ResourceName).IsRequired().HasMaxLength(50);
            entity.Property(a => a.ResourceId).IsRequired().HasMaxLength(100);
            entity.Property(a => a.IpAddress).HasMaxLength(50);

            // Index for chronological auditing
            entity.HasIndex(a => a.TimestampUtc);
            entity.HasIndex(a => a.ResourceId);
        });

        // -------------------------------------------------------------
        // 4. Role Configuration
        // -------------------------------------------------------------
        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.Property(r => r.Name).IsRequired().HasMaxLength(50);
            entity.HasIndex(r => r.Name).IsUnique();
            entity.Property(r => r.Description).HasMaxLength(250);
        });

        // -------------------------------------------------------------
        // 5. User Configuration (Persistent RBAC Accounts)
        // -------------------------------------------------------------
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(u => u.Id);
            entity.Property(u => u.Name).IsRequired().HasMaxLength(150);
            entity.Property(u => u.Email).IsRequired().HasMaxLength(256);
            entity.HasIndex(u => u.Email).IsUnique();
            entity.Property(u => u.PasswordHash).IsRequired().HasMaxLength(500);
            entity.Property(u => u.Initials).HasMaxLength(10);
            entity.Property(u => u.IsActive).HasDefaultValue(true);
            entity.Property(u => u.CreatedAtUtc).HasDefaultValueSql("GETUTCDATE()");
        });

        // -------------------------------------------------------------
        // 6. UserRole Many-to-Many Configuration
        // -------------------------------------------------------------
        modelBuilder.Entity<UserRole>(entity =>
        {
            entity.HasKey(ur => new { ur.UserId, ur.RoleId });

            entity.HasOne(ur => ur.User)
                  .WithMany(u => u.UserRoles)
                  .HasForeignKey(ur => ur.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(ur => ur.Role)
                  .WithMany(r => r.UserRoles)
                  .HasForeignKey(ur => ur.RoleId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
    }

    /// <summary>
    /// HIPAA Compliance Security Rule: Audit logs must be strictly immutable.
    /// Intercepts SaveChanges and rejects any UPDATE or DELETE on the AuditLog table.
    /// </summary>
    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var illegalAuditLogChanges = ChangeTracker.Entries<AuditLog>()
            .Where(e => e.State == EntityState.Modified || e.State == EntityState.Deleted)
            .ToList();

        if (illegalAuditLogChanges.Count != 0)
        {
            throw new InvalidOperationException("HIPAA Security Violation: Audit logs are immutable and cannot be modified or deleted.");
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}

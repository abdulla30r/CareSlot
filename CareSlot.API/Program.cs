using CareSlot.API.Hubs;
using CareSlot.Application.Common.Interfaces;
using CareSlot.Application.Common.Security;
using CareSlot.Domain.Entities;
using CareSlot.Infrastructure;
using CareSlot.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Register SignalR for real-time slot synchronization
builder.Services.AddSignalR();

// Register Clean Architecture Infrastructure (EF Core & Encryption & CurrentUser)
builder.Services.AddInfrastructure(builder.Configuration);

// Configure JWT Authentication
var jwtKey = builder.Configuration["JwtSettings:SecretKey"] 
    ?? "CareSlotSuperSecretSigningKeyForHIPAASystem2026!512bitLongString";
var jwtIssuer = builder.Configuration["JwtSettings:Issuer"] ?? "CareSlot.API";
var jwtAudience = builder.Configuration["JwtSettings:Audience"] ?? "CareSlot.Client";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(jwtKey)),
        ValidateIssuer = true,
        ValidIssuer = jwtIssuer,
        ValidateAudience = true,
        ValidAudience = jwtAudience,
        ClockSkew = TimeSpan.Zero
    };
});

// Configure CORS for Angular frontend and SignalR
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularApp", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Initialize SQL Server Database Tables & Seed RBAC
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    try
    {
        var context = services.GetRequiredService<CareSlotDbContext>();
        var passwordHasher = services.GetRequiredService<IPasswordHasherService>();

        // 1. Ensure Roles, Users, and UserRoles tables exist
        await context.Database.ExecuteSqlRawAsync(@"
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Roles')
            BEGIN
                CREATE TABLE [Roles] (
                    [Id] uniqueidentifier NOT NULL,
                    [Name] nvarchar(50) NOT NULL,
                    [Description] nvarchar(250) NULL,
                    [CreatedAtUtc] datetime2 NOT NULL DEFAULT GETUTCDATE(),
                    CONSTRAINT [PK_Roles] PRIMARY KEY ([Id])
                );
                CREATE UNIQUE INDEX [IX_Roles_Name] ON [Roles] ([Name]);
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
            BEGIN
                CREATE TABLE [Users] (
                    [Id] uniqueidentifier NOT NULL,
                    [Name] nvarchar(150) NOT NULL,
                    [Email] nvarchar(256) NOT NULL,
                    [PasswordHash] nvarchar(500) NOT NULL,
                    [Initials] nvarchar(10) NULL,
                    [CreatedAtUtc] datetime2 NOT NULL DEFAULT GETUTCDATE(),
                    [IsActive] bit NOT NULL DEFAULT 1,
                    CONSTRAINT [PK_Users] PRIMARY KEY ([Id])
                );
                CREATE UNIQUE INDEX [IX_Users_Email] ON [Users] ([Email]);
            END

            IF EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID('Users') AND name = 'Role'
            )
            BEGIN
                ALTER TABLE [Users] DROP COLUMN [Role];
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserRoles')
            BEGIN
                CREATE TABLE [UserRoles] (
                    [UserId] uniqueidentifier NOT NULL,
                    [RoleId] uniqueidentifier NOT NULL,
                    CONSTRAINT [PK_UserRoles] PRIMARY KEY ([UserId], [RoleId]),
                    CONSTRAINT [FK_UserRoles_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE CASCADE,
                    CONSTRAINT [FK_UserRoles_Roles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [Roles] ([Id]) ON DELETE CASCADE
                );
                CREATE INDEX [IX_UserRoles_RoleId] ON [UserRoles] ([RoleId]);
            END
        ");

        // 2. Seed Default Roles if missing
        var roleCustomer = await context.Roles.FirstOrDefaultAsync(r => r.Name == Roles.Customer);
        if (roleCustomer == null)
        {
            roleCustomer = new Role
            {
                Id = Guid.Parse("10000000-0000-0000-0000-000000000001"),
                Name = Roles.Customer,
                Description = "Self-service patient booking clinical appointments",
                CreatedAtUtc = DateTime.UtcNow
            };
            context.Roles.Add(roleCustomer);
        }

        var roleDoctor = await context.Roles.FirstOrDefaultAsync(r => r.Name == Roles.Doctor);
        if (roleDoctor == null)
        {
            roleDoctor = new Role
            {
                Id = Guid.Parse("10000000-0000-0000-0000-000000000002"),
                Name = Roles.Doctor,
                Description = "Attending Physician managing clinical availability and schedule",
                CreatedAtUtc = DateTime.UtcNow
            };
            context.Roles.Add(roleDoctor);
        }

        var roleAdmin = await context.Roles.FirstOrDefaultAsync(r => r.Name == Roles.Admin);
        if (roleAdmin == null)
        {
            roleAdmin = new Role
            {
                Id = Guid.Parse("10000000-0000-0000-0000-000000000003"),
                Name = Roles.Admin,
                Description = "System Administrator & Clinic Operations Auditor",
                CreatedAtUtc = DateTime.UtcNow
            };
            context.Roles.Add(roleAdmin);
        }
        await context.SaveChangesAsync();

        // 3. Seed Default Personas if missing
        if (!await context.Users.AnyAsync(u => u.Email == "patient@careslot.local"))
        {
            var patient = new User
            {
                Id = Guid.Parse("20000000-0000-0000-0000-000000000001"),
                Name = "John Doe",
                Email = "patient@careslot.local",
                Initials = "JD",
                CreatedAtUtc = DateTime.UtcNow,
                IsActive = true
            };
            patient.PasswordHash = passwordHasher.HashPassword("Patient123!");
            patient.UserRoles.Add(new UserRole { UserId = patient.Id, RoleId = roleCustomer.Id });
            context.Users.Add(patient);
        }

        if (!await context.Users.AnyAsync(u => u.Email == "doctor@careslot.local"))
        {
            var doctor = new User
            {
                Id = Guid.Parse("11111111-1111-1111-1111-111111111111"), // Matches Dr. Sarah Jenkins
                Name = "Dr. Sarah Jenkins",
                Email = "doctor@careslot.local",
                Initials = "SJ",
                CreatedAtUtc = DateTime.UtcNow,
                IsActive = true
            };
            doctor.PasswordHash = passwordHasher.HashPassword("Doctor123!");
            doctor.UserRoles.Add(new UserRole { UserId = doctor.Id, RoleId = roleDoctor.Id });
            context.Users.Add(doctor);
        }

        if (!await context.Users.AnyAsync(u => u.Email == "admin@careslot.local"))
        {
            var admin = new User
            {
                Id = Guid.Parse("30000000-0000-0000-0000-000000000001"),
                Name = "Marcus Brody",
                Email = "admin@careslot.local",
                Initials = "MB",
                CreatedAtUtc = DateTime.UtcNow,
                IsActive = true
            };
            admin.PasswordHash = passwordHasher.HashPassword("Admin123!");
            admin.UserRoles.Add(new UserRole { UserId = admin.Id, RoleId = roleAdmin.Id });
            context.Users.Add(admin);
        }

        await context.SaveChangesAsync();
        logger.LogInformation("Database RBAC tables and initial seed accounts verified successfully.");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "An error occurred while initializing the RBAC database tables.");
    }
}

app.UseCors("AllowAngularApp");

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Map SignalR Hub
app.MapHub<SchedulingHub>("/hubs/scheduling");

app.Run();

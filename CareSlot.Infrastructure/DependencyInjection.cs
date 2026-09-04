using CareSlot.Application.Common.Interfaces;
using CareSlot.Infrastructure.Persistence;
using CareSlot.Infrastructure.Security;
using CareSlot.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CareSlot.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // 1. Register HIPAA Encryption Engine
        services.AddSingleton<IEncryptionService, AesEncryptionService>();

        // 2. Register EF Core DbContext with SQL Server
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Server=localhost;Database=CareSlotDb;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True";

        services.AddDbContext<CareSlotDbContext>(options =>
            options.UseSqlServer(connectionString));

        // 3. Register Security, RBAC & Current User Context
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddSingleton<IPasswordHasherService, PasswordHasherService>();
        services.AddScoped<IJwtTokenService, JwtTokenService>();

        // 4. Register Scheduling Service
        services.AddScoped<ISchedulingService, SchedulingService>();

        return services;
    }
}


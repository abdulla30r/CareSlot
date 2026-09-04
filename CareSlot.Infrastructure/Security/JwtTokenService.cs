using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using CareSlot.Application.Common.Interfaces;
using CareSlot.Application.Common.Security;
using CareSlot.Application.DTOs;
using CareSlot.Domain.Entities;
using CareSlot.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace CareSlot.Infrastructure.Security;

public class JwtTokenService : IJwtTokenService
{
    private readonly IConfiguration _configuration;
    private readonly CareSlotDbContext _context;
    private readonly IPasswordHasherService _passwordHasher;

    public JwtTokenService(
        IConfiguration configuration,
        CareSlotDbContext context,
        IPasswordHasherService passwordHasher)
    {
        _configuration = configuration;
        _context = context;
        _passwordHasher = passwordHasher;
    }

    public async Task<IEnumerable<UserPersonaDto>> GetAvailablePersonasAsync(CancellationToken ct = default)
    {
        var users = await _context.Users
            .AsNoTracking()
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .Where(u => u.IsActive)
            .ToListAsync(ct);

        return users.Select(u =>
        {
            var primaryRole = u.UserRoles.FirstOrDefault()?.Role.Name ?? Roles.Customer;
            var roleDesc = u.UserRoles.FirstOrDefault()?.Role.Description ?? "CareSlot account";
            var defaultPassword = primaryRole switch
            {
                Roles.Doctor => "Doctor123!",
                Roles.Admin => "Admin123!",
                _ => "Patient123!"
            };

            return new UserPersonaDto(
                u.Id.ToString(),
                u.Name,
                u.Email,
                primaryRole,
                roleDesc,
                u.Initials,
                defaultPassword
            );
        });
    }

    public async Task<UserPersonaDto?> ValidateCredentialsAsync(string email, string password, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
            return null;

        var trimmed = email.Trim();

        var user = await _context.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u =>
                u.Email == trimmed ||
                u.Id.ToString() == trimmed ||
                u.UserRoles.Any(ur => ur.Role.Name == trimmed), ct);

        if (user == null || !user.IsActive)
            return null;

        if (!_passwordHasher.VerifyPassword(password, user.PasswordHash))
            return null;

        var primaryRole = user.UserRoles.FirstOrDefault()?.Role.Name ?? Roles.Customer;
        var roleDesc = user.UserRoles.FirstOrDefault()?.Role.Description ?? "CareSlot account";

        return new UserPersonaDto(
            user.Id.ToString(),
            user.Name,
            user.Email,
            primaryRole,
            roleDesc,
            user.Initials,
            password
        );
    }

    public async Task<UserPersonaDto> RegisterCustomerAsync(string name, string email, string password, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Full Name is required.", nameof(name));
        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("Email address is required.", nameof(email));
        if (string.IsNullOrWhiteSpace(password) || password.Length < 6)
            throw new ArgumentException("Password must be at least 6 characters.", nameof(password));

        var normalizedEmail = email.Trim().ToLowerInvariant();

        var exists = await _context.Users.AnyAsync(u => u.Email == normalizedEmail, ct);
        if (exists)
        {
            throw new InvalidOperationException("An account with this email address already exists.");
        }

        var customerRole = await _context.Roles.FirstOrDefaultAsync(r => r.Name == Roles.Customer, ct);
        if (customerRole == null)
        {
            customerRole = new Role
            {
                Id = Guid.NewGuid(),
                Name = Roles.Customer,
                Description = "Self-service patient booking clinical appointments"
            };
            _context.Roles.Add(customerRole);
        }

        var nameParts = name.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var initials = nameParts.Length switch
        {
            0 => "PT",
            1 => nameParts[0][0].ToString().ToUpperInvariant(),
            _ => $"{nameParts[0][0]}{nameParts[^1][0]}".ToUpperInvariant()
        };

        var user = new User
        {
            Id = Guid.NewGuid(),
            Name = name.Trim(),
            Email = normalizedEmail,
            Initials = initials,
            CreatedAtUtc = DateTime.UtcNow,
            IsActive = true
        };
        user.PasswordHash = _passwordHasher.HashPassword(password);

        var userRole = new UserRole
        {
            UserId = user.Id,
            RoleId = customerRole.Id,
            User = user,
            Role = customerRole
        };
        user.UserRoles.Add(userRole);

        _context.Users.Add(user);
        await _context.SaveChangesAsync(ct);

        return new UserPersonaDto(
            user.Id.ToString(),
            user.Name,
            user.Email,
            Roles.Customer,
            customerRole.Description,
            user.Initials,
            password
        );
    }

    public TokenResponse GenerateToken(string userId, string name, string role)
    {
        var secretKey = _configuration["JwtSettings:SecretKey"]
            ?? "CareSlotSuperSecretSigningKeyForHIPAASystem2026!512bitLongString";
        var issuer = _configuration["JwtSettings:Issuer"] ?? "CareSlot.API";
        var audience = _configuration["JwtSettings:Audience"] ?? "CareSlot.Client";
        var expiryMinutes = int.TryParse(_configuration["JwtSettings:ExpiryMinutes"], out var exp) ? exp : 120;

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var roleList = role.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId),
            new(ClaimTypes.Name, name),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        foreach (var r in roleList)
        {
            claims.Add(new Claim(ClaimTypes.Role, r));
        }

        var expiresAtUtc = DateTime.UtcNow.AddMinutes(expiryMinutes);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = expiresAtUtc,
            Issuer = issuer,
            Audience = audience,
            SigningCredentials = credentials
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(token);

        return new TokenResponse(tokenString, userId, name, roleList.FirstOrDefault() ?? Roles.Customer, expiresAtUtc);
    }
}

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using CareSlot.Application.Common.Interfaces;
using CareSlot.Application.Common.Security;
using CareSlot.Application.DTOs;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace CareSlot.Infrastructure.Security;

public class JwtTokenService : IJwtTokenService
{
    private readonly IConfiguration _configuration;

    private static readonly List<UserPersonaDto> _personas = new()
    {
        new UserPersonaDto(
            "customer-john", 
            "John Doe", 
            "patient@careslot.local",
            Roles.Customer, 
            "Self-service patient booking clinical appointments", 
            "JD",
            "Patient123!"
        ),
        new UserPersonaDto(
            "receptionist-elena", 
            "Elena Vance", 
            "receptionist@careslot.local",
            Roles.Receptionist, 
            "Front desk coordinator booking on behalf of clinic patients", 
            "EV",
            "Clinic123!"
        ),
        new UserPersonaDto(
            "doctor-sarah", 
            "Dr. Sarah Jenkins", 
            "doctor@careslot.local",
            Roles.Doctor, 
            "Attending Cardiologist inspecting schedule & generating slots", 
            "SJ",
            "Doctor123!"
        ),
        new UserPersonaDto(
            "admin-marcus", 
            "Marcus Brody", 
            "admin@careslot.local",
            Roles.Admin, 
            "System Administrator & HIPAA Compliance Auditor", 
            "MB",
            "Admin123!"
        )
    };

    public JwtTokenService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public IEnumerable<UserPersonaDto> GetAvailablePersonas() => _personas;

    public UserPersonaDto? ValidateCredentials(string email, string password)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
            return null;

        var persona = _personas.FirstOrDefault(p => 
            string.Equals(p.Email, email.Trim(), StringComparison.OrdinalIgnoreCase) ||
            string.Equals(p.Id, email.Trim(), StringComparison.OrdinalIgnoreCase) ||
            string.Equals(p.Role, email.Trim(), StringComparison.OrdinalIgnoreCase));

        if (persona != null && persona.DefaultPassword == password)
        {
            return persona;
        }

        return null;
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

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId),
            new(ClaimTypes.Name, name),
            new(ClaimTypes.Role, role),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

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

        return new TokenResponse(tokenString, userId, name, role, expiresAtUtc);
    }
}


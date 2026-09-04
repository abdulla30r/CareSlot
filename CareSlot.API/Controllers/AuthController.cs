using CareSlot.Application.Common.Interfaces;
using CareSlot.Application.Common.Security;
using CareSlot.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

using CareSlot.Domain.Entities;
using CareSlot.Infrastructure.Persistence;

namespace CareSlot.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IJwtTokenService _jwtTokenService;
    private readonly ICurrentUserService _currentUserService;
    private readonly CareSlotDbContext _context;

    public AuthController(
        IJwtTokenService jwtTokenService, 
        ICurrentUserService currentUserService,
        CareSlotDbContext context)
    {
        _jwtTokenService = jwtTokenService;
        _currentUserService = currentUserService;
        _context = context;
    }

    /// <summary>
    /// Authenticates a user with email and password, issuing a signed JWT token.
    /// Records HIPAA compliance audit logs for both successful and failed attempts.
    /// </summary>
    [HttpPost("login")]
    public async Task<ActionResult<TokenResponse>> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        var user = _jwtTokenService.ValidateCredentials(request.Email, request.Password);
        if (user == null)
        {
            _context.AuditLogs.Add(new AuditLog
            {
                UserId = request.Email,
                Action = "LOGIN_FAILED",
                ResourceName = "Auth",
                ResourceId = request.Email,
                IpAddress = clientIp,
                TimestampUtc = DateTime.UtcNow
            });
            await _context.SaveChangesAsync(ct);

            return Unauthorized(new { message = "Invalid email or password." });
        }

        // Record successful login
        _context.AuditLogs.Add(new AuditLog
        {
            UserId = user.Id,
            Action = "LOGIN_SUCCESS",
            ResourceName = "Auth",
            ResourceId = user.Id,
            IpAddress = clientIp,
            TimestampUtc = DateTime.UtcNow
        });
        await _context.SaveChangesAsync(ct);

        var tokenResponse = _jwtTokenService.GenerateToken(user.Id, user.Name, user.Role);
        return Ok(tokenResponse);
    }

    /// <summary>
    /// Returns the 4 available seed personas (Customer, Receptionist, Doctor, Admin) for testing and UI switching.
    /// </summary>
    [HttpGet("personas")]
    public ActionResult<IEnumerable<UserPersonaDto>> GetPersonas()
    {
        return Ok(_jwtTokenService.GetAvailablePersonas());
    }

    /// <summary>
    /// Issues a signed JWT token for a specific persona ID.
    /// </summary>
    [HttpPost("token")]
    public ActionResult<TokenResponse> GetToken([FromQuery] string personaId)
    {
        var persona = _jwtTokenService.GetAvailablePersonas()
            .FirstOrDefault(p => string.Equals(p.Id, personaId, StringComparison.OrdinalIgnoreCase) 
                              || string.Equals(p.Role, personaId, StringComparison.OrdinalIgnoreCase));

        if (persona == null)
        {
            return BadRequest(new { message = $"Persona '{personaId}' not found. Available personas: Customer, Receptionist, Doctor, Admin." });
        }

        var tokenResponse = _jwtTokenService.GenerateToken(persona.Id, persona.Name, persona.Role);
        return Ok(tokenResponse);
    }

    /// <summary>
    /// Returns the currently authenticated user's claims.
    /// </summary>
    [Authorize]
    [HttpGet("me")]
    public ActionResult GetCurrentUser()
    {
        return Ok(new
        {
            userId = _currentUserService.UserId,
            name = _currentUserService.Name,
            role = _currentUserService.Role,
            isAuthenticated = _currentUserService.IsAuthenticated
        });
    }
}


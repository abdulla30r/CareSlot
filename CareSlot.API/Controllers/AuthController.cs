using CareSlot.Application.Common.Interfaces;
using CareSlot.Application.DTOs;
using CareSlot.Domain.Entities;
using CareSlot.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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

        var user = await _jwtTokenService.ValidateCredentialsAsync(request.Email, request.Password, ct);
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
    /// Self-service account creation for patients. Role is strictly assigned to Customer.
    /// Staff roles (Doctor, Admin) cannot be self-registered.
    /// Records HIPAA compliance audit log.
    /// </summary>
    [HttpPost("register")]
    public async Task<ActionResult<TokenResponse>> Register([FromBody] RegisterCustomerRequest request, CancellationToken ct)
    {
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        try
        {
            var user = await _jwtTokenService.RegisterCustomerAsync(request.Name, request.Email, request.Password, ct);

            // Record audit log for patient registration
            _context.AuditLogs.Add(new AuditLog
            {
                UserId = user.Id,
                Action = "CUSTOMER_REGISTERED",
                ResourceName = "Auth",
                ResourceId = user.Id,
                IpAddress = clientIp,
                TimestampUtc = DateTime.UtcNow
            });
            await _context.SaveChangesAsync(ct);

            var tokenResponse = _jwtTokenService.GenerateToken(user.Id, user.Name, user.Role);
            return Ok(tokenResponse);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Returns the available seed personas (Customer, Doctor, Admin) from the database for testing and UI switching.
    /// </summary>
    [HttpGet("personas")]
    public async Task<ActionResult<IEnumerable<UserPersonaDto>>> GetPersonas(CancellationToken ct)
    {
        var personas = await _jwtTokenService.GetAvailablePersonasAsync(ct);
        return Ok(personas);
    }

    /// <summary>
    /// Issues a signed JWT token for a specific persona ID.
    /// </summary>
    [HttpPost("token")]
    public async Task<ActionResult<TokenResponse>> GetToken([FromQuery] string personaId, CancellationToken ct)
    {
        var personas = await _jwtTokenService.GetAvailablePersonasAsync(ct);
        var persona = personas.FirstOrDefault(p => 
            string.Equals(p.Id, personaId, StringComparison.OrdinalIgnoreCase) || 
            string.Equals(p.Role, personaId, StringComparison.OrdinalIgnoreCase));

        if (persona == null)
        {
            return BadRequest(new { message = $"Persona '{personaId}' not found. Available personas: Customer, Doctor, Admin." });
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

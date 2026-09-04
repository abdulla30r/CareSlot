using CareSlot.Application.Common.Interfaces;
using CareSlot.Application.Common.Security;
using CareSlot.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CareSlot.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IJwtTokenService _jwtTokenService;
    private readonly ICurrentUserService _currentUserService;

    public AuthController(IJwtTokenService jwtTokenService, ICurrentUserService currentUserService)
    {
        _jwtTokenService = jwtTokenService;
        _currentUserService = currentUserService;
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

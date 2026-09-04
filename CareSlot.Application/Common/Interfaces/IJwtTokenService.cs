using CareSlot.Application.DTOs;

namespace CareSlot.Application.Common.Interfaces;

public interface IJwtTokenService
{
    TokenResponse GenerateToken(string userId, string name, string role);
    IEnumerable<UserPersonaDto> GetAvailablePersonas();
}


using CareSlot.Application.DTOs;

namespace CareSlot.Application.Common.Interfaces;

public interface IJwtTokenService
{
    TokenResponse GenerateToken(string userId, string name, string role);
    Task<IEnumerable<UserPersonaDto>> GetAvailablePersonasAsync(CancellationToken ct = default);
    Task<UserPersonaDto?> ValidateCredentialsAsync(string email, string password, CancellationToken ct = default);
    Task<UserPersonaDto> RegisterCustomerAsync(string name, string email, string password, CancellationToken ct = default);
}

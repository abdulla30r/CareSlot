namespace CareSlot.Application.DTOs;

public record LoginRequest(string Email, string Password);

public record TokenResponse(
    string Token, 
    string UserId, 
    string Name, 
    string Role, 
    DateTime ExpiresAtUtc
);

public record UserPersonaDto(
    string Id, 
    string Name, 
    string Email,
    string Role, 
    string Description, 
    string AvatarInitials,
    string DefaultPassword
);


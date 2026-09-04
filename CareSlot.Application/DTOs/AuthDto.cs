namespace CareSlot.Application.DTOs;

public record LoginRequest(string Username, string Password);

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
    string Role, 
    string Description, 
    string AvatarInitials
);


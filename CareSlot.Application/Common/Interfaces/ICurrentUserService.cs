namespace CareSlot.Application.Common.Interfaces;

/// <summary>
/// Contract to access the authenticated user's identity and clinical role.
/// </summary>
public interface ICurrentUserService
{
    string? UserId { get; }
    string? Role { get; }
    string? Name { get; }
    bool IsAuthenticated { get; }
}

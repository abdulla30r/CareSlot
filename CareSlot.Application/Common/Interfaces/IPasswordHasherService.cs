namespace CareSlot.Application.Common.Interfaces;

/// <summary>
/// Cryptographic service to hash and verify passwords using salted PBKDF2/Argon2.
/// </summary>
public interface IPasswordHasherService
{
    string HashPassword(string password);
    bool VerifyPassword(string password, string passwordHash);
}

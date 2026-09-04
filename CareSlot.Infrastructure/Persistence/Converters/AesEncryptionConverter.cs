using CareSlot.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace CareSlot.Infrastructure.Persistence.Converters;

/// <summary>
/// Automatically encrypts plain-text string values before saving to the database,
/// and decrypts cipher text back into plain text when entities are queried.
/// </summary>
public class AesEncryptionConverter : ValueConverter<string?, string?>
{
    public AesEncryptionConverter(IEncryptionService encryptionService)
        : base(
            plainText => encryptionService.Encrypt(plainText),
            cipherText => encryptionService.Decrypt(cipherText))
    {
    }
}


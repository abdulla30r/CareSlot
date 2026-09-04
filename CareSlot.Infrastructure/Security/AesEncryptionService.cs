using System.Security.Cryptography;
using System.Text;
using CareSlot.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;

namespace CareSlot.Infrastructure.Security;

public class AesEncryptionService : IEncryptionService
{
    private readonly byte[] _key;

    public AesEncryptionService(IConfiguration configuration)
    {
        // 256-bit key (32 bytes). In production, this comes from Azure Key Vault or environment variables.
        var keyConfig = configuration["Encryption:Key"] ?? "CareSlotHIPAASecretKey2026!32b";
        _key = Encoding.UTF8.GetBytes(keyConfig.PadRight(32).Substring(0, 32));
    }

    public string? Encrypt(string? plainText)
    {
        if (string.IsNullOrEmpty(plainText))
            return plainText;

        using var aes = Aes.Create();
        aes.Key = _key;
        aes.GenerateIV(); // Unique 16-byte Initialization Vector for every single write

        using var encryptor = aes.CreateEncryptor(aes.Key, aes.IV);
        using var ms = new MemoryStream();
        
        // Write the IV first so we can read it back during decryption
        ms.Write(aes.IV, 0, aes.IV.Length);

        using (var cs = new CryptoStream(ms, encryptor, CryptoStreamMode.Write))
        using (var writer = new StreamWriter(cs, Encoding.UTF8))
        {
            writer.Write(plainText);
        }

        return Convert.ToBase64String(ms.ToArray());
    }

    public string? Decrypt(string? cipherText)
    {
        if (string.IsNullOrEmpty(cipherText))
            return cipherText;

        try
        {
            var fullCipher = Convert.FromBase64String(cipherText);

            using var aes = Aes.Create();
            aes.Key = _key;

            // Extract the 16-byte IV prepended at the start
            var iv = new byte[16];
            Array.Copy(fullCipher, 0, iv, 0, iv.Length);
            aes.IV = iv;

            using var decryptor = aes.CreateDecryptor(aes.Key, aes.IV);
            using var ms = new MemoryStream(fullCipher, 16, fullCipher.Length - 16);
            using var cs = new CryptoStream(ms, decryptor, CryptoStreamMode.Read);
            using var reader = new StreamReader(cs, Encoding.UTF8);

            return reader.ReadToEnd();
        }
        catch
        {
            // If decryption fails (e.g. data corrupted or invalid key), return raw string or null
            return cipherText;
        }
    }
}


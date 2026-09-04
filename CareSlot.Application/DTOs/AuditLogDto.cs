namespace CareSlot.Application.DTOs;

public record AuditLogDto(
    Guid Id,
    string UserId,
    string Action,
    string ResourceName,
    string ResourceId,
    string IpAddress,
    DateTime TimestampUtc
);


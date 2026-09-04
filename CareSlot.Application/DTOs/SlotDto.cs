namespace CareSlot.Application.DTOs;

public record SlotDto(
    Guid Id,
    Guid DoctorId,
    DateTime StartTime,
    DateTime EndTime,
    string Status,
    string RowVersion,
    string? HeldBy = null,
    string? PatientName = null
);


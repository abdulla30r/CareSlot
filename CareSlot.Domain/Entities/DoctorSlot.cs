using CareSlot.Domain.Enums;

namespace CareSlot.Domain.Entities;

public class DoctorSlot
{
    public Guid Id { get; set; } = Guid.NewGuid();

    // Relationship to Doctor
    public Guid DoctorId { get; set; }
    public Doctor? Doctor { get; set; }

    // Schedule Times (stored in UTC)
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }

    // State of the slot
    public SlotStatus Status { get; set; } = SlotStatus.Available;

    // Concurrency Token:
    // EF Core tracks this byte array to prevent two users from modifying the slot at the same time
    public byte[] RowVersion { get; set; } = [];

    // Temporary Hold Information (for real-time reservation)
    public string? HeldBy { get; set; }
    public DateTime? HeldUntilUtc { get; set; }

    // Booking Details (populated once booked)
    public string? PatientName { get; set; }

    // Sensitive Protected Health Information (PHI) - Encrypted at rest
    public string? EncryptedNid { get; set; }
    public string? EncryptedNotes { get; set; }
}


namespace CareSlot.Domain.Entities;

public class AuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();

    // Who performed the action (e.g. User ID, Receptionist name, or "System")
    public string UserId { get; set; } = string.Empty;

    // What happened (e.g. "SLOT_HELD", "SLOT_BOOKED", "PHI_VIEWED")
    public string Action { get; set; } = string.Empty;

    // The type of resource affected (e.g. "DoctorSlot")
    public string ResourceName { get; set; } = string.Empty;

    // The ID of the affected record
    public string ResourceId { get; set; } = string.Empty;

    // Client's IP address for security auditing
    public string IpAddress { get; set; } = string.Empty;

    // Exact UTC timestamp of the event
    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
}


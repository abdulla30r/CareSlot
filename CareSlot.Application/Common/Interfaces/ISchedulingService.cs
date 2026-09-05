using CareSlot.Application.DTOs;

namespace CareSlot.Application.Common.Interfaces;

public interface ISchedulingService
{
    // 1. Get all available clinicians
    Task<List<DoctorDto>> GetDoctorsAsync(CancellationToken ct = default);

    // 2. Get schedule slots for a doctor in a date range (handles expired holds automatically)
    Task<List<SlotDto>> GetDoctorSlotsAsync(Guid doctorId, DateTime startDate, DateTime endDate, CancellationToken ct = default);

    // 2b. Get confirmed booked appointments for a doctor
    Task<List<SlotDto>> GetDoctorAppointmentsAsync(Guid doctorId, DateTime startDate, DateTime endDate, CancellationToken ct = default);

    // 3. Helper to generate realistic 30-min slots for testing the calendar
    Task<List<SlotDto>> GenerateWeeklySlotsAsync(Guid doctorId, DateTime weekStartDate, CancellationToken ct = default);

    // 4. Temporary Hold (Concurrency Check 1: Locks slot for 2 minutes)
    Task<SlotDto> HoldSlotAsync(Guid slotId, HoldSlotRequest request, string clientIp, CancellationToken ct = default);

    // 5. Release Hold (e.g. if user cancels the booking dialog)
    Task<SlotDto> ReleaseSlotAsync(Guid slotId, string connectionId, string clientIp, CancellationToken ct = default);

    // 6. Confirm Booking (Concurrency Check 2 & Encrypts PHI at rest)
    Task<SlotDto> BookSlotAsync(Guid slotId, BookSlotRequest request, string clientIp, CancellationToken ct = default);

    // 7. Get chronological HIPAA Audit Logs
    Task<List<AuditLogDto>> GetAuditLogsAsync(int limit = 50, CancellationToken ct = default);

    // 8. Get Appointment Clinical Details (Doctor/Admin only, logs PHI_ACCESSED)
    Task<AppointmentDetailsDto> GetSlotDetailsAsync(Guid slotId, string clientIp, CancellationToken ct = default);

    // 9. Manage Doctor (Admin only: CRUD operations with audit logs)
    Task<DoctorDto> CreateDoctorAsync(CreateDoctorRequest request, string clientIp, CancellationToken ct = default);
    Task<DoctorDto> UpdateDoctorAsync(Guid id, UpdateDoctorRequest request, string clientIp, CancellationToken ct = default);
    Task DeleteDoctorAsync(Guid id, string clientIp, CancellationToken ct = default);

    // 10. Manage Availability (Doctor & Admin: custom shifts, intervals, clearing open slots)
    Task<List<SlotDto>> ConfigureAvailabilityAsync(Guid doctorId, ManageAvailabilityRequest request, string clientIp, CancellationToken ct = default);
    Task<int> ClearUnbookedSlotsAsync(Guid doctorId, DateTime startDate, DateTime endDate, string clientIp, CancellationToken ct = default);

    // 11. Populate / Seed Demo Slots across clinicians
    Task<int> PopulateDemoSlotsAsync(CancellationToken ct = default);
}


using CareSlot.Application.Common.Interfaces;
using CareSlot.Application.DTOs;
using CareSlot.Domain.Entities;
using CareSlot.Domain.Enums;
using CareSlot.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CareSlot.Infrastructure.Services;

public class SchedulingService : ISchedulingService
{
    private readonly CareSlotDbContext _context;
    private readonly ILogger<SchedulingService> _logger;
    private readonly ICurrentUserService _currentUserService;

    public SchedulingService(
        CareSlotDbContext context, 
        ILogger<SchedulingService> logger,
        ICurrentUserService currentUserService)
    {
        _context = context;
        _logger = logger;
        _currentUserService = currentUserService;
    }

    public async Task<List<DoctorDto>> GetDoctorsAsync(CancellationToken ct = default)
    {
        return await _context.Doctors
            .AsNoTracking()
            .OrderBy(d => d.Name)
            .Select(d => new DoctorDto(d.Id, d.Name, d.Specialty))
            .ToListAsync(ct);
    }

    public async Task<List<SlotDto>> GetDoctorSlotsAsync(Guid doctorId, DateTime startDate, DateTime endDate, CancellationToken ct = default)
    {
        // 1. Release any expired holds automatically
        var now = DateTime.UtcNow;
        var expiredHolds = await _context.DoctorSlots
            .Where(s => s.DoctorId == doctorId && s.Status == SlotStatus.Held && s.HeldUntilUtc < now)
            .ToListAsync(ct);

        if (expiredHolds.Count != 0)
        {
            foreach (var expired in expiredHolds)
            {
                expired.Status = SlotStatus.Available;
                expired.HeldBy = null;
                expired.HeldUntilUtc = null;
            }
            await _context.SaveChangesAsync(ct);
        }

        // 2. Return slots in range
        return await _context.DoctorSlots
            .AsNoTracking()
            .Where(s => s.DoctorId == doctorId && s.StartTime >= startDate && s.EndTime <= endDate)
            .OrderBy(s => s.StartTime)
            .Select(s => new SlotDto(
                s.Id,
                s.DoctorId,
                s.StartTime,
                s.EndTime,
                s.Status.ToString(),
                Convert.ToBase64String(s.RowVersion),
                s.HeldBy,
                s.PatientName
            ))
            .ToListAsync(ct);
    }

    public async Task<List<SlotDto>> GetDoctorAppointmentsAsync(Guid doctorId, DateTime startDate, DateTime endDate, CancellationToken ct = default)
    {
        return await _context.DoctorSlots
            .AsNoTracking()
            .Where(s => s.DoctorId == doctorId && s.Status == SlotStatus.Booked && s.StartTime >= startDate && s.StartTime <= endDate)
            .OrderBy(s => s.StartTime)
            .Select(s => new SlotDto(
                s.Id,
                s.DoctorId,
                s.StartTime,
                s.EndTime,
                s.Status.ToString(),
                Convert.ToBase64String(s.RowVersion),
                s.HeldBy,
                s.PatientName
            ))
            .ToListAsync(ct);
    }

    public async Task<List<SlotDto>> GenerateWeeklySlotsAsync(Guid doctorId, DateTime weekStartDate, CancellationToken ct = default)
    {
        var doctor = await _context.Doctors.FindAsync([doctorId], ct);
        if (doctor == null)
            throw new KeyNotFoundException($"Doctor with ID '{doctorId}' not found.");

        // Start from the Monday of the requested week
        var monday = weekStartDate.Date.AddDays(-(int)weekStartDate.DayOfWeek + (int)DayOfWeek.Monday);
        var friday = monday.AddDays(4);

        var existingCount = await _context.DoctorSlots
            .Where(s => s.DoctorId == doctorId && s.StartTime >= monday && s.StartTime <= friday.AddDays(1))
            .CountAsync(ct);

        if (existingCount > 0)
        {
            // Already generated, return existing slots
            return await GetDoctorSlotsAsync(doctorId, monday, friday.AddDays(1), ct);
        }

        var newSlots = new List<DoctorSlot>();

        // Generate 30-minute slots for Monday through Friday (9:00 AM to 5:00 PM)
        for (int day = 0; day < 5; day++)
        {
            var currentDay = monday.AddDays(day);
            var slotTime = currentDay.AddHours(9); // 9:00 AM
            var dayEnd = currentDay.AddHours(17);   // 5:00 PM

            while (slotTime < dayEnd)
            {
                newSlots.Add(new DoctorSlot
                {
                    DoctorId = doctorId,
                    StartTime = slotTime,
                    EndTime = slotTime.AddMinutes(30),
                    Status = SlotStatus.Available
                });

                slotTime = slotTime.AddMinutes(30);
            }
        }

        _context.DoctorSlots.AddRange(newSlots);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Generated {Count} slots for Dr. {DoctorName}", newSlots.Count, doctor.Name);

        return await GetDoctorSlotsAsync(doctorId, monday, friday.AddDays(1), ct);
    }

    public async Task<SlotDto> HoldSlotAsync(Guid slotId, HoldSlotRequest request, string clientIp, CancellationToken ct = default)
    {
        var slot = await _context.DoctorSlots.FirstOrDefaultAsync(s => s.Id == slotId, ct);
        if (slot == null)
            throw new KeyNotFoundException("Slot not found.");

        if (slot.Status == SlotStatus.Booked)
            throw new InvalidOperationException("This slot is already booked.");

        // If held by another user and hold has NOT expired
        if (slot.Status == SlotStatus.Held && slot.HeldUntilUtc > DateTime.UtcNow && slot.HeldBy != request.ConnectionId)
            throw new InvalidOperationException("This slot is currently being held by another user.");

        // Optimistic Concurrency Token check
        byte[] originalRowVersion = Convert.FromBase64String(request.RowVersion);
        _context.Entry(slot).Property(s => s.RowVersion).OriginalValue = originalRowVersion;

        // Apply Hold
        slot.Status = SlotStatus.Held;
        slot.HeldBy = request.ConnectionId;
        slot.HeldUntilUtc = DateTime.UtcNow.AddMinutes(2); // 2-minute reservation

        // Record HIPAA Audit Trail
        _context.AuditLogs.Add(new AuditLog
        {
            UserId = _currentUserService.UserId ?? request.ConnectionId,
            Action = "SLOT_HELD",
            ResourceName = nameof(DoctorSlot),
            ResourceId = slot.Id.ToString(),
            IpAddress = clientIp,
            TimestampUtc = DateTime.UtcNow
        });

        try
        {
            await _context.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            _logger.LogWarning("Race condition detected: Slot {SlotId} was modified by another transaction.", slotId);
            throw new InvalidOperationException("Race condition detected: another user modified this slot at the exact same moment. Please refresh.");
        }

        return new SlotDto(
            slot.Id,
            slot.DoctorId,
            slot.StartTime,
            slot.EndTime,
            slot.Status.ToString(),
            Convert.ToBase64String(slot.RowVersion),
            slot.HeldBy,
            slot.PatientName
        );
    }

    public async Task<SlotDto> ReleaseSlotAsync(Guid slotId, string connectionId, string clientIp, CancellationToken ct = default)
    {
        var slot = await _context.DoctorSlots.FirstOrDefaultAsync(s => s.Id == slotId, ct);
        if (slot == null)
            throw new KeyNotFoundException("Slot not found.");

        // Only release if it's currently held by this connection
        if (slot.Status == SlotStatus.Held && slot.HeldBy == connectionId)
        {
            slot.Status = SlotStatus.Available;
            slot.HeldBy = null;
            slot.HeldUntilUtc = null;

            _context.AuditLogs.Add(new AuditLog
            {
                UserId = _currentUserService.UserId ?? connectionId,
                Action = "SLOT_RELEASED",
                ResourceName = nameof(DoctorSlot),
                ResourceId = slot.Id.ToString(),
                IpAddress = clientIp,
                TimestampUtc = DateTime.UtcNow
            });

            await _context.SaveChangesAsync(ct);
        }

        return new SlotDto(
            slot.Id,
            slot.DoctorId,
            slot.StartTime,
            slot.EndTime,
            slot.Status.ToString(),
            Convert.ToBase64String(slot.RowVersion),
            slot.HeldBy,
            slot.PatientName
        );
    }

    public async Task<SlotDto> BookSlotAsync(Guid slotId, BookSlotRequest request, string clientIp, CancellationToken ct = default)
    {
        var slot = await _context.DoctorSlots.FirstOrDefaultAsync(s => s.Id == slotId, ct);
        if (slot == null)
            throw new KeyNotFoundException("Slot not found.");

        if (slot.Status == SlotStatus.Booked)
            throw new InvalidOperationException("This slot is already booked.");

        // Optimistic Concurrency Token check
        byte[] originalRowVersion = Convert.FromBase64String(request.RowVersion);
        _context.Entry(slot).Property(s => s.RowVersion).OriginalValue = originalRowVersion;

        // Book slot & attach patient info (EncryptedNid & Notes are encrypted transparently by EF Core)
        slot.Status = SlotStatus.Booked;
        slot.PatientName = request.PatientName;
        slot.EncryptedNid = request.NationalId;
        slot.EncryptedNotes = request.ClinicalNotes;
        slot.HeldBy = null;
        slot.HeldUntilUtc = null;

        // Record HIPAA Audit Trail (Notice: NID and notes are NOT written to cleartext audit logs)
        _context.AuditLogs.Add(new AuditLog
        {
            UserId = _currentUserService.UserId ?? request.PatientName,
            Action = "APPOINTMENT_BOOKED",
            ResourceName = nameof(DoctorSlot),
            ResourceId = slot.Id.ToString(),
            IpAddress = clientIp,
            TimestampUtc = DateTime.UtcNow
        });

        try
        {
            await _context.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            _logger.LogWarning("Race condition detected during booking of slot {SlotId}", slotId);
            throw new InvalidOperationException("Double-booking prevented: This slot was updated or confirmed by someone else while you were filling the form.");
        }

        return new SlotDto(
            slot.Id,
            slot.DoctorId,
            slot.StartTime,
            slot.EndTime,
            slot.Status.ToString(),
            Convert.ToBase64String(slot.RowVersion),
            slot.HeldBy,
            slot.PatientName
        );
    }

    public async Task<List<AuditLogDto>> GetAuditLogsAsync(int limit = 50, CancellationToken ct = default)
    {
        return await _context.AuditLogs
            .AsNoTracking()
            .OrderByDescending(a => a.TimestampUtc)
            .Take(limit)
            .Select(a => new AuditLogDto(
                a.Id,
                a.UserId,
                a.Action,
                a.ResourceName,
                a.ResourceId,
                a.IpAddress,
                a.TimestampUtc
            ))
            .ToListAsync(ct);
    }

    public async Task<AppointmentDetailsDto> GetSlotDetailsAsync(Guid slotId, string clientIp, CancellationToken ct = default)
    {
        var slot = await _context.DoctorSlots
            .Include(s => s.Doctor)
            .FirstOrDefaultAsync(s => s.Id == slotId, ct);

        if (slot == null)
            throw new KeyNotFoundException("Slot not found.");

        if (slot.Status != SlotStatus.Booked)
            throw new InvalidOperationException("Appointment details are only available for booked slots.");

        // Record HIPAA Audit Trail: PHI Access Log
        _context.AuditLogs.Add(new AuditLog
        {
            UserId = _currentUserService.UserId ?? "clinician",
            Action = "PHI_ACCESSED",
            ResourceName = nameof(DoctorSlot),
            ResourceId = slot.Id.ToString(),
            IpAddress = clientIp,
            TimestampUtc = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);

        return new AppointmentDetailsDto(
            slot.Id,
            slot.DoctorId,
            slot.Doctor?.Name ?? "Attending Clinician",
            slot.StartTime,
            slot.EndTime,
            slot.PatientName ?? "Confidential Patient",
            slot.EncryptedNid ?? "Not Provided",
            slot.EncryptedNotes ?? "No clinical notes attached."
        );
    }

    public async Task<DoctorDto> CreateDoctorAsync(CreateDoctorRequest request, string clientIp, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Doctor name is required.", nameof(request.Name));
        if (string.IsNullOrWhiteSpace(request.Specialty))
            throw new ArgumentException("Doctor specialty is required.", nameof(request.Specialty));

        var doctor = new Doctor
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Specialty = request.Specialty.Trim()
        };

        _context.Doctors.Add(doctor);

        _context.AuditLogs.Add(new AuditLog
        {
            UserId = _currentUserService.UserId ?? "admin",
            Action = "DOCTOR_CREATED",
            ResourceName = nameof(Doctor),
            ResourceId = doctor.Id.ToString(),
            IpAddress = clientIp,
            TimestampUtc = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Clinician '{DoctorName}' ({Specialty}) created by {User}", doctor.Name, doctor.Specialty, _currentUserService.UserId);

        return new DoctorDto(doctor.Id, doctor.Name, doctor.Specialty);
    }

    public async Task<DoctorDto> UpdateDoctorAsync(Guid id, UpdateDoctorRequest request, string clientIp, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Doctor name is required.", nameof(request.Name));
        if (string.IsNullOrWhiteSpace(request.Specialty))
            throw new ArgumentException("Doctor specialty is required.", nameof(request.Specialty));

        var doctor = await _context.Doctors.FindAsync([id], ct);
        if (doctor == null)
            throw new KeyNotFoundException($"Clinician with ID '{id}' not found.");

        doctor.Name = request.Name.Trim();
        doctor.Specialty = request.Specialty.Trim();

        _context.AuditLogs.Add(new AuditLog
        {
            UserId = _currentUserService.UserId ?? "admin",
            Action = "DOCTOR_UPDATED",
            ResourceName = nameof(Doctor),
            ResourceId = doctor.Id.ToString(),
            IpAddress = clientIp,
            TimestampUtc = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Clinician '{DoctorName}' updated by {User}", doctor.Name, _currentUserService.UserId);

        return new DoctorDto(doctor.Id, doctor.Name, doctor.Specialty);
    }

    public async Task DeleteDoctorAsync(Guid id, string clientIp, CancellationToken ct = default)
    {
        var doctor = await _context.Doctors.FindAsync([id], ct);
        if (doctor == null)
            throw new KeyNotFoundException($"Clinician with ID '{id}' not found.");

        // Clinical Safety Guard: Prevent deleting a doctor with confirmed patient bookings
        var hasActiveBookings = await _context.DoctorSlots
            .AnyAsync(s => s.DoctorId == id && s.Status == SlotStatus.Booked, ct);

        if (hasActiveBookings)
        {
            throw new InvalidOperationException("Cannot remove clinician with active booked patient appointments. Please reassign or cancel appointments first.");
        }

        _context.Doctors.Remove(doctor);

        _context.AuditLogs.Add(new AuditLog
        {
            UserId = _currentUserService.UserId ?? "admin",
            Action = "DOCTOR_DELETED",
            ResourceName = nameof(Doctor),
            ResourceId = id.ToString(),
            IpAddress = clientIp,
            TimestampUtc = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Clinician '{DoctorName}' ({DoctorId}) removed by {User}", doctor.Name, id, _currentUserService.UserId);
    }

    public async Task<List<SlotDto>> ConfigureAvailabilityAsync(
        Guid doctorId, 
        ManageAvailabilityRequest request, 
        string clientIp, 
        CancellationToken ct = default)
    {
        var doctor = await _context.Doctors.FindAsync([doctorId], ct);
        if (doctor == null)
            throw new KeyNotFoundException($"Clinician with ID '{doctorId}' not found.");

        if (request.StartDate > request.EndDate)
            throw new ArgumentException("Start date cannot be after end date.");

        if (request.DailyStartTime >= request.DailyEndTime)
            throw new ArgumentException("Daily start time must be earlier than daily end time.");

        var durationMinutes = request.SlotDurationMinutes > 0 ? request.SlotDurationMinutes : 30;

        // Fetch existing slots in the range to avoid overlapping duplicate slots
        var rangeStart = request.StartDate.Date.Add(request.DailyStartTime);
        var rangeEnd = request.EndDate.Date.Add(request.DailyEndTime);

        var existingSlotTimes = await _context.DoctorSlots
            .Where(s => s.DoctorId == doctorId && s.StartTime >= rangeStart && s.StartTime <= rangeEnd)
            .Select(s => s.StartTime)
            .ToListAsync(ct);

        var existingSet = new HashSet<DateTime>(existingSlotTimes);
        var newSlots = new List<DoctorSlot>();

        var totalDays = (request.EndDate.Date - request.StartDate.Date).Days + 1;

        for (int i = 0; i < totalDays; i++)
        {
            var currentDay = request.StartDate.Date.AddDays(i);

            if (request.SkipWeekends && (currentDay.DayOfWeek == DayOfWeek.Saturday || currentDay.DayOfWeek == DayOfWeek.Sunday))
                continue;

            var dayStart = currentDay.Add(request.DailyStartTime);
            var dayEnd = currentDay.Add(request.DailyEndTime);

            var slotStart = dayStart;
            while (slotStart.AddMinutes(durationMinutes) <= dayEnd)
            {
                if (!existingSet.Contains(slotStart))
                {
                    newSlots.Add(new DoctorSlot
                    {
                        DoctorId = doctorId,
                        StartTime = slotStart,
                        EndTime = slotStart.AddMinutes(durationMinutes),
                        Status = SlotStatus.Available
                    });
                    existingSet.Add(slotStart);
                }

                slotStart = slotStart.AddMinutes(durationMinutes);
            }
        }

        if (newSlots.Count > 0)
        {
            _context.DoctorSlots.AddRange(newSlots);

            _context.AuditLogs.Add(new AuditLog
            {
                UserId = _currentUserService.UserId ?? "clinician",
                Action = "AVAILABILITY_CONFIGURED",
                ResourceName = nameof(DoctorSlot),
                ResourceId = doctorId.ToString(),
                IpAddress = clientIp,
                TimestampUtc = DateTime.UtcNow
            });

            await _context.SaveChangesAsync(ct);
        }

        return await GetDoctorSlotsAsync(doctorId, rangeStart, rangeEnd, ct);
    }

    public async Task<int> ClearUnbookedSlotsAsync(
        Guid doctorId, 
        DateTime startDate, 
        DateTime endDate, 
        string clientIp, 
        CancellationToken ct = default)
    {
        var doctor = await _context.Doctors.FindAsync([doctorId], ct);
        if (doctor == null)
            throw new KeyNotFoundException($"Clinician with ID '{doctorId}' not found.");

        // Strictly delete only AVAILABLE slots; preserve Booked and active Held slots!
        var unbookedSlots = await _context.DoctorSlots
            .Where(s => s.DoctorId == doctorId 
                     && s.StartTime >= startDate 
                     && s.StartTime <= endDate 
                     && s.Status == SlotStatus.Available)
            .ToListAsync(ct);

        if (unbookedSlots.Count == 0)
            return 0;

        _context.DoctorSlots.RemoveRange(unbookedSlots);

        _context.AuditLogs.Add(new AuditLog
        {
            UserId = _currentUserService.UserId ?? "clinician",
            Action = "SLOTS_CLEARED",
            ResourceName = nameof(DoctorSlot),
            ResourceId = doctorId.ToString(),
            IpAddress = clientIp,
            TimestampUtc = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Cleared {Count} unbooked slots for Dr. {DoctorName} between {Start} and {End}", 
            unbookedSlots.Count, doctor.Name, startDate, endDate);

        return unbookedSlots.Count;
    }

    public async Task<int> PopulateDemoSlotsAsync(CancellationToken ct = default)
    {
        var doctors = await _context.Doctors.ToListAsync(ct);
        if (doctors.Count == 0) return 0;

        var now = DateTime.UtcNow.Date;
        int diff = (7 + (int)now.DayOfWeek - (int)DayOfWeek.Monday) % 7;
        var currentMonday = now.AddDays(-diff);

        var sampleSlots = new List<DoctorSlot>();

        foreach (var doc in doctors)
        {
            // Populate current week and next week (10 weekdays)
            for (int week = 0; week < 2; week++)
            {
                var weekStart = currentMonday.AddDays(week * 7);
                for (int day = 0; day < 5; day++) // Monday to Friday
                {
                    var dayDate = weekStart.AddDays(day);

                    // Daily shift hours: 9 AM, 10 AM, 11 AM, 2 PM, 3 PM, 4 PM
                    var hours = new[] { 9, 10, 11, 14, 15, 16 };

                    foreach (var h in hours)
                    {
                        var start1 = dayDate.AddHours(h);
                        var start2 = dayDate.AddHours(h).AddMinutes(30);

                        if (!await _context.DoctorSlots.AnyAsync(s => s.DoctorId == doc.Id && s.StartTime == start1, ct))
                        {
                            sampleSlots.Add(new DoctorSlot
                            {
                                Id = Guid.NewGuid(),
                                DoctorId = doc.Id,
                                StartTime = start1,
                                EndTime = start1.AddMinutes(30),
                                Status = SlotStatus.Available
                            });
                        }

                        if (!await _context.DoctorSlots.AnyAsync(s => s.DoctorId == doc.Id && s.StartTime == start2, ct))
                        {
                            sampleSlots.Add(new DoctorSlot
                            {
                                Id = Guid.NewGuid(),
                                DoctorId = doc.Id,
                                StartTime = start2,
                                EndTime = start2.AddMinutes(30),
                                Status = SlotStatus.Available
                            });
                        }
                    }
                }
            }
        }

        if (sampleSlots.Count > 0)
        {
            // Seed sample booked consultation for Dr. Sarah Jenkins
            var drJenkins = doctors.FirstOrDefault(d => d.Name.Contains("Jenkins") || d.Specialty.Contains("Cardio"));
            if (drJenkins != null)
            {
                var bookedSlot = sampleSlots.FirstOrDefault(s => s.DoctorId == drJenkins.Id);
                if (bookedSlot != null)
                {
                    bookedSlot.Status = SlotStatus.Booked;
                    bookedSlot.PatientName = "John Doe";
                    bookedSlot.EncryptedNid = "NID-9482014";
                    bookedSlot.EncryptedNotes = "Patient presents with episodic exertional dyspnea and palpitations. Prescribed ECG.";
                }
            }

            // Seed sample booked consultation for Dr. Emily Rodriguez
            var drRodriguez = doctors.FirstOrDefault(d => d.Name.Contains("Rodriguez") || d.Specialty.Contains("Pediatric"));
            if (drRodriguez != null)
            {
                var bookedSlot = sampleSlots.FirstOrDefault(s => s.DoctorId == drRodriguez.Id);
                if (bookedSlot != null)
                {
                    bookedSlot.Status = SlotStatus.Booked;
                    bookedSlot.PatientName = "Sophie Taylor";
                    bookedSlot.EncryptedNid = "NID-8830192";
                    bookedSlot.EncryptedNotes = "Routine 6-month developmental milestone evaluation and vaccination schedule.";
                }
            }

            _context.DoctorSlots.AddRange(sampleSlots);
            await _context.SaveChangesAsync(ct);
            _logger.LogInformation("Successfully populated {Count} clinical schedule slots.", sampleSlots.Count);
        }

        return sampleSlots.Count;
    }
}


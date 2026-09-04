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
            throw new InvalidOperationException("This slot is currently being booked by another receptionist.");

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
}


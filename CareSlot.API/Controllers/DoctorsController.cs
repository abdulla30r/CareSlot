using CareSlot.Application.Common.Interfaces;
using CareSlot.Application.Common.Security;
using CareSlot.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CareSlot.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class DoctorsController : ControllerBase
{
    private readonly ISchedulingService _schedulingService;
    private readonly ICurrentUserService _currentUserService;

    public DoctorsController(
        ISchedulingService schedulingService,
        ICurrentUserService currentUserService)
    {
        _schedulingService = schedulingService;
        _currentUserService = currentUserService;
    }

    /// <summary>
    /// Returns all available doctors for the frontend selector.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<DoctorDto>>> GetDoctors(CancellationToken ct)
    {
        var doctors = await _schedulingService.GetDoctorsAsync(ct);
        return Ok(doctors);
    }

    /// <summary>
    /// Returns a doctor's slots for a given date window (e.g. current week).
    /// </summary>
    [HttpGet("{id:guid}/slots")]
    public async Task<ActionResult<List<SlotDto>>> GetSlots(
        Guid id,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        CancellationToken ct)
    {
        // Default to current Monday through next 2 weeks if dates not provided
        var now = DateTime.UtcNow.Date;
        int diff = (7 + (int)now.DayOfWeek - (int)DayOfWeek.Monday) % 7;
        var currentMonday = now.AddDays(-diff);

        var start = startDate ?? currentMonday;
        var end = endDate ?? currentMonday.AddDays(14);

        var slots = await _schedulingService.GetDoctorSlotsAsync(id, start, end, ct);
        return Ok(slots);
    }

    /// <summary>
    /// Populates or seeds demo schedule slots for all doctors.
    /// Accessible to any authenticated user to enable immediate testing/demonstration.
    /// </summary>
    [HttpPost("populate-demo-slots")]
    public async Task<ActionResult> PopulateDemoSlots(CancellationToken ct)
    {
        var count = await _schedulingService.PopulateDemoSlotsAsync(ct);
        return Ok(new { message = $"Successfully populated {count} clinical slots across all clinicians.", slotsCreated = count });
    }

    /// <summary>
    /// Returns confirmed booked appointments for a doctor.
    /// Restricted to the Doctor herself or Admin.
    /// </summary>
    [Authorize(Roles = $"{Roles.Doctor},{Roles.Admin}")]
    [HttpGet("{id:guid}/appointments")]
    public async Task<ActionResult<List<SlotDto>>> GetAppointments(
        Guid id,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        CancellationToken ct)
    {
        if (!await CanManageDoctorScheduleAsync(id, ct))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Access Denied: Clinicians are strictly authorized to view only their own appointments." });
        }

        var start = startDate ?? DateTime.UtcNow.Date.AddDays(-30);
        var end = endDate ?? DateTime.UtcNow.Date.AddDays(90);

        var appointments = await _schedulingService.GetDoctorAppointmentsAsync(id, start, end, ct);
        return Ok(appointments);
    }

    /// <summary>
    /// Helper endpoint to generate Monday-Friday 30-min slots for testing.
    /// Restricted to Doctors and Admins.
    /// </summary>
    [Authorize(Roles = $"{Roles.Doctor},{Roles.Admin}")]
    [HttpPost("{id:guid}/slots/generate")]
    public async Task<ActionResult<List<SlotDto>>> GenerateSlots(
        Guid id,
        [FromQuery] DateTime? weekStartDate,
        CancellationToken ct)
    {
        if (!await CanManageDoctorScheduleAsync(id, ct))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Access Denied: Clinicians are strictly authorized to manage only their own clinical availability." });
        }

        var start = weekStartDate ?? DateTime.UtcNow;
        var slots = await _schedulingService.GenerateWeeklySlotsAsync(id, start, ct);
        return Ok(slots);
    }

    /// <summary>
    /// Admin: Create a new clinician with name and medical specialty.
    /// </summary>
    [Authorize(Roles = Roles.Admin)]
    [HttpPost]
    public async Task<ActionResult<DoctorDto>> CreateDoctor([FromBody] CreateDoctorRequest request, CancellationToken ct)
    {
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        try
        {
            var doctor = await _schedulingService.CreateDoctorAsync(request, clientIp, ct);
            return CreatedAtAction(nameof(GetDoctors), new { id = doctor.Id }, doctor);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Admin: Update clinician details (Name, Specialty).
    /// </summary>
    [Authorize(Roles = Roles.Admin)]
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<DoctorDto>> UpdateDoctor(Guid id, [FromBody] UpdateDoctorRequest request, CancellationToken ct)
    {
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        try
        {
            var doctor = await _schedulingService.UpdateDoctorAsync(id, request, clientIp, ct);
            return Ok(doctor);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Admin: Delete clinician (blocked if active booked appointments exist).
    /// </summary>
    [Authorize(Roles = Roles.Admin)]
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> DeleteDoctor(Guid id, CancellationToken ct)
    {
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        try
        {
            await _schedulingService.DeleteDoctorAsync(id, clientIp, ct);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Doctor & Admin: Configure custom availability shifts, intervals, and date ranges.
    /// </summary>
    [Authorize(Roles = $"{Roles.Doctor},{Roles.Admin}")]
    [HttpPost("{id:guid}/availability")]
    public async Task<ActionResult<List<SlotDto>>> ConfigureAvailability(
        Guid id, 
        [FromBody] ManageAvailabilityRequest request, 
        CancellationToken ct)
    {
        if (!await CanManageDoctorScheduleAsync(id, ct))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Access Denied: Clinicians are strictly authorized to manage only their own clinical availability." });
        }

        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        try
        {
            var slots = await _schedulingService.ConfigureAvailabilityAsync(id, request, clientIp, ct);
            return Ok(slots);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Doctor & Admin: Clear unbooked slots for a date range (takes time off).
    /// Existing confirmed patient bookings are strictly preserved.
    /// </summary>
    [Authorize(Roles = $"{Roles.Doctor},{Roles.Admin}")]
    [HttpDelete("{id:guid}/availability/unbooked")]
    public async Task<ActionResult> ClearUnbookedSlots(
        Guid id, 
        [FromQuery] DateTime startDate, 
        [FromQuery] DateTime endDate, 
        CancellationToken ct)
    {
        if (!await CanManageDoctorScheduleAsync(id, ct))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Access Denied: Clinicians are strictly authorized to manage only their own clinical availability." });
        }

        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        try
        {
            var cleared = await _schedulingService.ClearUnbookedSlotsAsync(id, startDate, endDate, clientIp, ct);
            return Ok(new { clearedSlotsCount = cleared });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Enforces RBAC clinician ownership: Admins can manage any clinician.
    /// Doctors can strictly only manage their own clinical schedule & availability.
    /// </summary>
    private async Task<bool> CanManageDoctorScheduleAsync(Guid doctorId, CancellationToken ct)
    {
        if (_currentUserService.Role == Roles.Admin)
        {
            return true;
        }

        if (_currentUserService.Role == Roles.Doctor)
        {
            if (Guid.TryParse(_currentUserService.UserId, out var currentDoctorId) && currentDoctorId == doctorId)
            {
                return true;
            }

            var doctors = await _schedulingService.GetDoctorsAsync(ct);
            var targetDoctor = doctors.FirstOrDefault(d => d.Id == doctorId);
            if (targetDoctor != null)
            {
                if (string.Equals(_currentUserService.UserId, targetDoctor.Id.ToString(), StringComparison.OrdinalIgnoreCase) ||
                    (!string.IsNullOrWhiteSpace(_currentUserService.Name) && 
                     string.Equals(_currentUserService.Name, targetDoctor.Name, StringComparison.OrdinalIgnoreCase)))
                {
                    return true;
                }
            }
        }

        return false;
    }
}


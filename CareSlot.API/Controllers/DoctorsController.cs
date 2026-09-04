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

    public DoctorsController(ISchedulingService schedulingService)
    {
        _schedulingService = schedulingService;
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
        // Default to current week (Monday to Friday) if dates not provided
        var start = startDate ?? DateTime.UtcNow.Date;
        var end = endDate ?? start.AddDays(7);

        var slots = await _schedulingService.GetDoctorSlotsAsync(id, start, end, ct);
        return Ok(slots);
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
        var start = weekStartDate ?? DateTime.UtcNow;
        var slots = await _schedulingService.GenerateWeeklySlotsAsync(id, start, ct);
        return Ok(slots);
    }
}


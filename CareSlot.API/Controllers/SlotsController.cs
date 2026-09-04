using CareSlot.API.Hubs;
using CareSlot.Application.Common.Interfaces;
using CareSlot.Application.DTOs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace CareSlot.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SlotsController : ControllerBase
{
    private readonly ISchedulingService _schedulingService;
    private readonly IHubContext<SchedulingHub> _hubContext;

    public SlotsController(
        ISchedulingService schedulingService,
        IHubContext<SchedulingHub> hubContext)
    {
        _schedulingService = schedulingService;
        _hubContext = hubContext;
    }

    /// <summary>
    /// Holds a slot temporarily for 2 minutes while user fills the booking form.
    /// Returns 409 Conflict if another user beat them to it.
    /// </summary>
    [HttpPost("{id:guid}/hold")]
    public async Task<ActionResult<SlotDto>> HoldSlot(
        Guid id,
        [FromBody] HoldSlotRequest request,
        CancellationToken ct)
    {
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        try
        {
            var updatedSlot = await _schedulingService.HoldSlotAsync(id, request, clientIp, ct);
            await _hubContext.Clients.All.SendAsync("SlotHeld", updatedSlot, ct);
            return Ok(updatedSlot);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            // HTTP 409 Conflict: Signals to the client that a race condition occurred
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Releases a held slot back to Available if the user cancels the booking dialog.
    /// </summary>
    [HttpPost("{id:guid}/release")]
    public async Task<ActionResult<SlotDto>> ReleaseSlot(
        Guid id,
        [FromQuery] string connectionId,
        CancellationToken ct)
    {
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        try
        {
            var updatedSlot = await _schedulingService.ReleaseSlotAsync(id, connectionId, clientIp, ct);
            await _hubContext.Clients.All.SendAsync("SlotReleased", updatedSlot, ct);
            return Ok(updatedSlot);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Confirms the booking, writing patient details and encrypting PHI at rest.
    /// Returns 409 Conflict if a double-booking race condition is detected.
    /// </summary>
    [HttpPost("{id:guid}/book")]
    public async Task<ActionResult<SlotDto>> BookSlot(
        Guid id,
        [FromBody] BookSlotRequest request,
        CancellationToken ct)
    {
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        try
        {
            var bookedSlot = await _schedulingService.BookSlotAsync(id, request, clientIp, ct);
            await _hubContext.Clients.All.SendAsync("SlotBooked", bookedSlot, ct);
            return Ok(bookedSlot);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            // HTTP 409 Conflict: Double-booking race condition caught!
            return Conflict(new { message = ex.Message });
        }
    }
}


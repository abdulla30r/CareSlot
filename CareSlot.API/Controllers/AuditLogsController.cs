using CareSlot.Application.Common.Interfaces;
using CareSlot.Application.DTOs;
using Microsoft.AspNetCore.Mvc;

namespace CareSlot.API.Controllers;

[ApiController]
[Route("api/audit-logs")]
public class AuditLogsController : ControllerBase
{
    private readonly ISchedulingService _schedulingService;

    public AuditLogsController(ISchedulingService schedulingService)
    {
        _schedulingService = schedulingService;
    }

    /// <summary>
    /// Returns the most recent immutable HIPAA audit logs for clinical compliance inspection.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<AuditLogDto>>> GetAuditLogs(
        [FromQuery] int limit = 50,
        CancellationToken ct = default)
    {
        var logs = await _schedulingService.GetAuditLogsAsync(limit, ct);
        return Ok(logs);
    }
}


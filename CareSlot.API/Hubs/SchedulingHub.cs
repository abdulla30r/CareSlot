using Microsoft.AspNetCore.SignalR;

namespace CareSlot.API.Hubs;

public class SchedulingHub : Hub
{
    private readonly ILogger<SchedulingHub> _logger;

    public SchedulingHub(ILogger<SchedulingHub> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// When an Angular client opens a doctor's calendar, they join that doctor's room.
    /// </summary>
    public async Task JoinDoctorCalendar(string doctorId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, doctorId);
        _logger.LogInformation("Client {ConnectionId} joined Doctor Room {DoctorId}", Context.ConnectionId, doctorId);
    }

    /// <summary>
    /// When an Angular client switches to a different doctor, they leave the room.
    /// </summary>
    public async Task LeaveDoctorCalendar(string doctorId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, doctorId);
        _logger.LogInformation("Client {ConnectionId} left Doctor Room {DoctorId}", Context.ConnectionId, doctorId);
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("SignalR Client connected: {ConnectionId}", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("SignalR Client disconnected: {ConnectionId}", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}


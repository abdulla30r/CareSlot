namespace CareSlot.Application.DTOs;

public record ManageAvailabilityRequest(
    DateTime StartDate,
    DateTime EndDate,
    TimeSpan DailyStartTime,
    TimeSpan DailyEndTime,
    int SlotDurationMinutes = 30,
    bool SkipWeekends = true
);

public record ClearAvailabilityRequest(
    DateTime StartDate,
    DateTime EndDate
);


namespace CareSlot.Application.DTOs;

public record HoldSlotRequest(
    string ConnectionId,
    string RowVersion
);


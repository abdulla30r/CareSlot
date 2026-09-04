namespace CareSlot.Application.DTOs;

public record BookSlotRequest(
    string PatientName,
    string NationalId,
    string ClinicalNotes,
    string RowVersion
);


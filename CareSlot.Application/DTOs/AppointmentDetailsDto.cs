namespace CareSlot.Application.DTOs;

public record AppointmentDetailsDto(
    Guid SlotId,
    Guid DoctorId,
    string DoctorName,
    DateTime StartTime,
    DateTime EndTime,
    string PatientName,
    string NationalId,
    string ClinicalNotes
);


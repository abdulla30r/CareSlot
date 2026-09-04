namespace CareSlot.Application.DTOs;

public record CreateDoctorRequest(
    string Name,
    string Specialty
);

public record UpdateDoctorRequest(
    string Name,
    string Specialty
);


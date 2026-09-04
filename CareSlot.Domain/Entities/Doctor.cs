namespace CareSlot.Domain.Entities;

public class Doctor
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Specialty { get; set; } = string.Empty;

    // Navigation property: One doctor can have many appointment slots
    public ICollection<DoctorSlot> Slots { get; set; } = new List<DoctorSlot>();
}


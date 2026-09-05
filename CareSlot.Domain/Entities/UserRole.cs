namespace CareSlot.Domain.Entities;

/// <summary>
/// Join entity representing many-to-many relationship between User and Role.
/// </summary>
public class UserRole
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public Guid RoleId { get; set; }
    public Role Role { get; set; } = null!;
}


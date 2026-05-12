namespace Obscura.Infrastructure.Persistence.Entities;

public sealed class EntityCreditLinkRow
{
    public Guid EntityId { get; set; }

    public Guid PersonEntityId { get; set; }

    public string Role { get; set; } = string.Empty;

    public string? Character { get; set; }

    public int SortOrder { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

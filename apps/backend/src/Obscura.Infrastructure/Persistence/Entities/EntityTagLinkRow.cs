namespace Obscura.Infrastructure.Persistence.Entities;

public sealed class EntityTagLinkRow
{
    public Guid EntityId { get; set; }

    public Guid TagId { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

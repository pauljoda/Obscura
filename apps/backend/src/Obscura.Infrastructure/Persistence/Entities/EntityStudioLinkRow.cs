namespace Obscura.Infrastructure.Persistence.Entities;

public sealed class EntityStudioLinkRow
{
    public Guid EntityId { get; set; }

    public Guid StudioId { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

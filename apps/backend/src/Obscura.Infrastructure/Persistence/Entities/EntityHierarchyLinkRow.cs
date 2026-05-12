namespace Obscura.Infrastructure.Persistence.Entities;

public sealed class EntityHierarchyLinkRow
{
    public Guid ParentEntityId { get; set; }

    public Guid ChildEntityId { get; set; }

    public string Relationship { get; set; } = string.Empty;

    public int SortOrder { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

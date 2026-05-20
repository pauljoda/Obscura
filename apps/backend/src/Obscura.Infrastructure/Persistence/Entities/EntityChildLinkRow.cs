namespace Obscura.Infrastructure.Persistence.Entities;

public sealed class EntityChildLinkRow {
    public Guid ParentEntityId { get; set; }

    public Guid ChildEntityId { get; set; }

    public string ChildKindCode { get; set; } = string.Empty;

    public int SortOrder { get; set; }

    public bool IsStructural { get; set; }

    public string? Source { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

namespace Obscura.Infrastructure.Persistence.Entities;

public sealed class EntityKindRow
{
    public string Code { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string Category { get; set; } = string.Empty;

    public string StorageShape { get; set; } = string.Empty;

    public bool IsLeaf { get; set; }

    public string AllowedChildKindCodesJson { get; set; } = "[]";
}

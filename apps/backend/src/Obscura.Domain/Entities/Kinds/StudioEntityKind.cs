namespace Obscura.Domain.Entities;

/// <summary>Studio taxonomy entity kind.</summary>
public sealed record StudioEntityKind()
    : IEntityKind
{
    public EntityKindCode Value => EntityKindCode.Studio;
    public string Code => "studio";
    public string DisplayName => "Studio";
    public EntityKindCategory Category => EntityKindCategory.Taxonomy;
}

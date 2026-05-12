namespace Obscura.Domain.Entities;

/// <summary>Single image media entity kind.</summary>
public sealed record ImageEntityKind()
    : IEntityKind
{
    public EntityKindCode Value => EntityKindCode.Image;
    public string Code => "image";
    public string DisplayName => "Image";
    public EntityKindCategory Category => EntityKindCategory.Media;
}

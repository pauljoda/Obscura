namespace Obscura.Domain.Entities;

using Obscura.Domain.Capabilities;

/// <summary>Video season structural entity kind.</summary>
public sealed record VideoSeasonEntityKind()
    : IEntityKind
{
    public string Code => "video-season";
    public string DisplayName => "Video Season";
    public EntityKindCategory Category => EntityKindCategory.Media;
    public IReadOnlyList<EntityFileRole> ImageAssetRoles =>
    [
        EntityFileRole.Thumbnail,
        EntityFileRole.Poster
    ];
    public IReadOnlyList<ICapabilityKind> SupportedCapabilities =>
    [
        CapabilityRegistry.Images,
        CapabilityRegistry.Description,
        CapabilityRegistry.Links,
        CapabilityRegistry.Dates,
        CapabilityRegistry.Source,
        CapabilityRegistry.Position
    ];
}

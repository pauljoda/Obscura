namespace Obscura.Domain.Entities;

using Obscura.Domain.Capabilities;
using Obscura.Domain.Media;

/// <summary>Video season structural entity kind.</summary>
public sealed record VideoSeasonEntityKind()
    : IEntityKind<VideoSeason>
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

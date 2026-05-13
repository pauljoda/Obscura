namespace Obscura.Domain.Entities;

using Obscura.Domain.Capabilities;

/// <summary>Video series entity kind.</summary>
public sealed record VideoSeriesEntityKind()
    : IEntityKind
{
    public string Code => "video-series";
    public string DisplayName => "Video Series";
    public EntityKindCategory Category => EntityKindCategory.Media;
    public IReadOnlyList<EntityFileRole> ImageAssetRoles =>
    [
        EntityFileRole.Thumbnail,
        EntityFileRole.Poster,
        EntityFileRole.Backdrop,
        EntityFileRole.Logo
    ];
    public IReadOnlyList<ICapabilityKind> SupportedCapabilities =>
    [
        CapabilityRegistry.Rating,
        CapabilityRegistry.Tags,
        CapabilityRegistry.Credits,
        CapabilityRegistry.Studio,
        CapabilityRegistry.Images,
        CapabilityRegistry.Description,
        CapabilityRegistry.Links,
        CapabilityRegistry.Flags,
        CapabilityRegistry.Files,
        CapabilityRegistry.Fingerprints,
        CapabilityRegistry.Stats,
        CapabilityRegistry.Dates,
        CapabilityRegistry.Source,
        CapabilityRegistry.Classification
    ];
}

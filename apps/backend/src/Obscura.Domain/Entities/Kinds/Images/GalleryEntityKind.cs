namespace Obscura.Domain.Entities;

using Obscura.Domain.Capabilities;
using Obscura.Domain.Media;

/// <summary>Image gallery entity kind.</summary>
public sealed record GalleryEntityKind()
    : IEntityKind<Gallery>
{
    public string Code => "gallery";
    public string DisplayName => "Gallery";
    public EntityKindCategory Category => EntityKindCategory.Media;
    public IReadOnlyList<EntityFileRole> ImageAssetRoles =>
    [
        EntityFileRole.Thumbnail,
        EntityFileRole.Cover
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
        CapabilityRegistry.Source
    ];
}

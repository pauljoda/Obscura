namespace Obscura.Domain.Entities;

using Obscura.Domain.Capabilities;

/// <summary>Book, comic, or manga entity kind.</summary>
public sealed record BookEntityKind()
    : IEntityKind
{
    public string Code => "book";
    public string DisplayName => "Book";
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
        CapabilityRegistry.Source,
        CapabilityRegistry.Progress
    ];
}

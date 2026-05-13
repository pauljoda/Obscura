namespace Obscura.Domain.Entities;

using Obscura.Domain.Capabilities;

/// <summary>User-curated collection entity kind.</summary>
public sealed record CollectionEntityKind()
    : IEntityKind
{
    public string Code => "collection";
    public string DisplayName => "Collection";
    public EntityKindCategory Category => EntityKindCategory.Collection;
    public IReadOnlyList<EntityFileRole> ImageAssetRoles =>
    [
        EntityFileRole.Thumbnail,
        EntityFileRole.Cover
    ];
    public IReadOnlyList<ICapabilityKind> SupportedCapabilities =>
    [
        CapabilityRegistry.Rating,
        CapabilityRegistry.Tags,
        CapabilityRegistry.Images,
        CapabilityRegistry.Description,
        CapabilityRegistry.Links,
        CapabilityRegistry.Flags,
        CapabilityRegistry.Files,
        CapabilityRegistry.Stats,
        CapabilityRegistry.Dates
    ];
}

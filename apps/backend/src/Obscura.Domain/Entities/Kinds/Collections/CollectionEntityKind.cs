namespace Obscura.Domain.Entities;

using Obscura.Domain.Capabilities;
using Obscura.Domain.Media;

/// <summary>User-curated collection entity kind.</summary>
public sealed record CollectionEntityKind()
    : IEntityKind<Collection>
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
        CapabilityRegistry.Images,
        CapabilityRegistry.Description,
        CapabilityRegistry.Links,
        CapabilityRegistry.Flags,
        CapabilityRegistry.Files,
        CapabilityRegistry.Stats,
        CapabilityRegistry.Dates
    ];
}

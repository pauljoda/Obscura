namespace Obscura.Domain.Entities;

using Obscura.Domain.Capabilities;

/// <summary>Studio taxonomy entity kind.</summary>
public sealed record StudioEntityKind()
    : IEntityKind
{
    public string Code => "studio";
    public string DisplayName => "Studio";
    public EntityKindCategory Category => EntityKindCategory.Taxonomy;
    public IReadOnlyList<EntityFileRole> ImageAssetRoles =>
    [
        EntityFileRole.Thumbnail,
        EntityFileRole.Logo
    ];
    public IReadOnlyList<ICapabilityKind> SupportedCapabilities =>
    [
        CapabilityRegistry.Rating,
        CapabilityRegistry.Tags,
        CapabilityRegistry.Images,
        CapabilityRegistry.Description,
        CapabilityRegistry.Links,
        CapabilityRegistry.Flags,
        CapabilityRegistry.Files
    ];
}

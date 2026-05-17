namespace Obscura.Domain.Entities;

using Obscura.Domain.Capabilities;
using Obscura.Domain.Taxonomy;

/// <summary>Studio taxonomy entity kind.</summary>
public sealed record StudioEntityKind()
    : IEntityKind<Studio>
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
        CapabilityRegistry.Images,
        CapabilityRegistry.Description,
        CapabilityRegistry.Dates,
        CapabilityRegistry.Lifetime,
        CapabilityRegistry.Links,
        CapabilityRegistry.Flags,
        CapabilityRegistry.Files
    ];
}

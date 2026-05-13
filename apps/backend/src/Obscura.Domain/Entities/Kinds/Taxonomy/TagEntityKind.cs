namespace Obscura.Domain.Entities;

using Obscura.Domain.Capabilities;

/// <summary>Tag taxonomy entity kind.</summary>
public sealed record TagEntityKind()
    : IEntityKind
{
    public string Code => "tag";
    public string DisplayName => "Tag";
    public EntityKindCategory Category => EntityKindCategory.Taxonomy;
    public IReadOnlyList<EntityFileRole> ImageAssetRoles => [EntityFileRole.Thumbnail];
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

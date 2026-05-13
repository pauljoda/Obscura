namespace Obscura.Domain.Entities;

using Obscura.Domain.Capabilities;

/// <summary>Person taxonomy entity kind.</summary>
public sealed record PersonEntityKind()
    : IEntityKind
{
    public string Code => "person";
    public string DisplayName => "Person";
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
        CapabilityRegistry.Files,
        CapabilityRegistry.Dates
    ];
}

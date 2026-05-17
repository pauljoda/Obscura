namespace Obscura.Domain.Entities;

using Obscura.Domain.Capabilities;
using Obscura.Domain.Taxonomy;

/// <summary>Person taxonomy entity kind.</summary>
public sealed record PersonEntityKind()
    : IEntityKind<Person>
{
    public string Code => "person";
    public string DisplayName => "Person";
    public EntityKindCategory Category => EntityKindCategory.Taxonomy;
    public IReadOnlyList<EntityFileRole> ImageAssetRoles => [EntityFileRole.Thumbnail, EntityFileRole.Poster];
    public IReadOnlyList<ICapabilityKind> SupportedCapabilities =>
    [
        CapabilityRegistry.Rating,
        CapabilityRegistry.Tags,
        CapabilityRegistry.Images,
        CapabilityRegistry.Description,
        CapabilityRegistry.Dates,
        CapabilityRegistry.Lifetime,
        CapabilityRegistry.Links,
        CapabilityRegistry.Flags,
        CapabilityRegistry.Files
    ];
}

namespace Obscura.Domain.Entities;

using Obscura.Domain.Capabilities;

/// <summary>Book chapter structural entity kind.</summary>
public sealed record BookChapterEntityKind()
    : IEntityKind
{
    public string Code => "book-chapter";
    public string DisplayName => "Book Chapter";
    public EntityKindCategory Category => EntityKindCategory.Media;
    public IReadOnlyList<EntityFileRole> ImageAssetRoles =>
    [
        EntityFileRole.Thumbnail,
        EntityFileRole.Cover
    ];
    public IReadOnlyList<ICapabilityKind> SupportedCapabilities =>
    [
        CapabilityRegistry.Images,
        CapabilityRegistry.Description,
        CapabilityRegistry.Files,
        CapabilityRegistry.Fingerprints,
        CapabilityRegistry.Stats,
        CapabilityRegistry.Source,
        CapabilityRegistry.Position
    ];
}

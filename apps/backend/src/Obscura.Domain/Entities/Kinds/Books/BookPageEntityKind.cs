namespace Obscura.Domain.Entities;

using Obscura.Domain.Capabilities;
using Obscura.Domain.Media;

/// <summary>Book page structural entity kind.</summary>
public sealed record BookPageEntityKind()
    : IEntityKind<BookPage>
{
    public string Code => "book-page";
    public string DisplayName => "Book Page";
    public EntityKindCategory Category => EntityKindCategory.Media;
    public IReadOnlyList<EntityFileRole> ImageAssetRoles => [EntityFileRole.Source];
    public IReadOnlyList<ICapabilityKind> SupportedCapabilities =>
    [
        CapabilityRegistry.Images,
        CapabilityRegistry.Files,
        CapabilityRegistry.Fingerprints,
        CapabilityRegistry.Technical,
        CapabilityRegistry.Source,
        CapabilityRegistry.Position
    ];
}

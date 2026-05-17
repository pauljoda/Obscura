namespace Obscura.Domain.Entities;

using Obscura.Domain.Capabilities;
using Obscura.Domain.Media;

/// <summary>Book volume structural entity kind.</summary>
public sealed record BookVolumeEntityKind()
    : IEntityKind<BookVolume>
{
    public string Code => "book-volume";
    public string DisplayName => "Book Volume";
    public EntityKindCategory Category => EntityKindCategory.Media;
    public IReadOnlyList<ICapabilityKind> SupportedCapabilities =>
    [
        CapabilityRegistry.Images,
        CapabilityRegistry.Files,
        CapabilityRegistry.Stats,
        CapabilityRegistry.Source,
        CapabilityRegistry.Position
    ];
}

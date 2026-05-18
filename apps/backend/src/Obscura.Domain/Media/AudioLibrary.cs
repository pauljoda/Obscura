using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Domain model for an album, audiobook, podcast, or other audio grouping.
/// </summary>
public sealed class AudioLibrary : Entity {
    public AudioLibrary(Guid id, string title, IEnumerable<EntityCapability>? capabilities = null)
        : base(id, title, capabilities ?? DefaultCapabilities()) {
    }

    public override EntityKind Kind => EntityKind.AudioLibrary;

    private static IEnumerable<EntityCapability> DefaultCapabilities() =>
    [
        new CapabilityRating(),
        new CapabilityImages(),
        new CapabilityLinks(),
        new CapabilityFlags(),
        new CapabilityFiles()
    ];
}

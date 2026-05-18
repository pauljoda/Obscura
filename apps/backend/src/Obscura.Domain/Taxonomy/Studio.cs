using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Taxonomy;

/// <summary>
/// Domain model for studio, publisher, label, or production-group taxonomy entities.
/// </summary>
public sealed class Studio : Entity {
    public Studio(Guid id, string title, IEnumerable<EntityCapability>? capabilities = null)
        : base(id, title, capabilities ?? DefaultCapabilities()) {
    }

    public override EntityKind Kind => EntityKind.Studio;

    private static IEnumerable<EntityCapability> DefaultCapabilities() =>
    [
        new CapabilityRating(),
        new CapabilityImages(),
        new CapabilityLinks(),
        new CapabilityFlags(),
        new CapabilityFiles()
    ];
}

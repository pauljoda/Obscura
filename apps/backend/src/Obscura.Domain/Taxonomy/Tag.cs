using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Taxonomy;

/// <summary>
/// Domain model for a tag taxonomy entity.
/// </summary>
public sealed class Tag : Entity {
    public Tag(Guid id, string title, bool ignoreAutoTag = false, IEnumerable<EntityCapability>? capabilities = null)
        : base(id, title, capabilities ?? DefaultCapabilities()) {
        IgnoreAutoTag = ignoreAutoTag;
    }

    public override EntityKind Kind => EntityKind.Tag;
    public bool IgnoreAutoTag { get; private set; }

    private static IEnumerable<EntityCapability> DefaultCapabilities() =>
    [
        new CapabilityRating(),
        new CapabilityImages(),
        new CapabilityLinks(),
        new CapabilityFlags(),
        new CapabilityFiles()
    ];
}

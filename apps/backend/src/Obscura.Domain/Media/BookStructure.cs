using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Structural book volume aggregate.
/// </summary>
public sealed class BookVolume : Entity {
    public BookVolume(Guid id, string title, IEnumerable<EntityCapability>? capabilities = null)
        : base(id, title, capabilities ?? [new CapabilityImages(), new CapabilityFiles(), new CapabilityStats(), new CapabilitySource(), new CapabilityPosition()]) {
    }

    public override EntityKind Kind => EntityKind.BookVolume;
}

/// <summary>
/// Structural book chapter aggregate.
/// </summary>
public sealed class BookChapter : Entity {
    public BookChapter(Guid id, string title, Guid? coverPageId, IEnumerable<EntityCapability>? capabilities = null)
        : base(id, title, capabilities ?? [new CapabilityImages(), new CapabilityFiles(), new CapabilityFingerprints(), new CapabilityStats(), new CapabilitySource(), new CapabilityPosition()]) {
        CoverPageId = coverPageId;
    }

    public override EntityKind Kind => EntityKind.BookChapter;
    public Guid? CoverPageId { get; private set; }
}

/// <summary>
/// Structural book page aggregate.
/// </summary>
public sealed class BookPage : Entity {
    public BookPage(Guid id, string title, IEnumerable<EntityCapability>? capabilities = null)
        : base(id, title, capabilities ?? [new CapabilityImages(), new CapabilityFiles(), new CapabilityFingerprints(), new CapabilityTechnical(), new CapabilitySource(), new CapabilityPosition()]) {
    }

    public override EntityKind Kind => EntityKind.BookPage;
}

using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Structural book volume aggregate used by chaptered or volume-grouped books.
/// </summary>
public sealed record BookVolume : Entity
{
    public BookVolume(
        Guid Id,
        string Title,
        IReadOnlyList<ICapability>? capabilities = null)
        : base(
            Id,
            EntityKindRegistry.BookVolume,
            Title,
            capabilities ?? [CapabilityImages.Empty, CapabilityFiles.Empty, CapabilityStats.Empty, CapabilitySource.Empty, CapabilityPosition.Empty])
    {
    }

    public BookVolume(Entity entity)
        : this(entity.Id, entity.Title, entity.Capabilities)
    {
    }
}

/// <summary>
/// Structural book chapter aggregate used by readers and book hierarchy traversal.
/// </summary>
public sealed record BookChapter : Entity
{
    public BookChapter(
        Guid Id,
        string Title,
        Guid? CoverPageId,
        IReadOnlyList<ICapability>? capabilities = null)
        : base(
            Id,
            EntityKindRegistry.BookChapter,
            Title,
            capabilities ?? [CapabilityImages.Empty, CapabilityFiles.Empty, CapabilityFingerprints.Empty, CapabilityStats.Empty, CapabilitySource.Empty, CapabilityPosition.Empty])
    {
        this.CoverPageId = CoverPageId;
    }

    public Guid? CoverPageId { get; init; }

    public BookChapter(Entity entity, Guid? CoverPageId)
        : this(entity.Id, entity.Title, CoverPageId, entity.Capabilities)
    {
    }
}

/// <summary>
/// Structural book page aggregate used by readers and image projection.
/// </summary>
public sealed record BookPage : Entity
{
    public BookPage(
        Guid Id,
        string Title,
        IReadOnlyList<ICapability>? capabilities = null)
        : base(
            Id,
            EntityKindRegistry.BookPage,
            Title,
            capabilities ?? [CapabilityImages.Empty, CapabilityFiles.Empty, CapabilityFingerprints.Empty, CapabilityTechnical.Empty, CapabilitySource.Empty, CapabilityPosition.Empty])
    {
    }

    public BookPage(Entity entity)
        : this(entity.Id, entity.Title, entity.Capabilities)
    {
    }
}

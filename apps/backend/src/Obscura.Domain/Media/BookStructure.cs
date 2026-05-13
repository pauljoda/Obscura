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
        Guid BookId,
        IReadOnlyList<ICapability>? capabilities = null)
        : base(
            Id,
            EntityKindRegistry.BookVolume,
            Title,
            capabilities ?? [CapabilityImages.Empty, CapabilityFiles.Empty, CapabilityStats.Empty, CapabilitySource.Empty, CapabilityPosition.Empty])
    {
        this.BookId = BookId;
    }

    public Guid BookId { get; init; }

    public BookVolume(Entity entity, Guid BookId)
        : this(entity.Id, entity.Title, BookId, entity.Capabilities)
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
        Guid BookId,
        Guid? VolumeId,
        Guid? CoverPageId,
        IReadOnlyList<ICapability>? capabilities = null)
        : base(
            Id,
            EntityKindRegistry.BookChapter,
            Title,
            capabilities ?? [CapabilityImages.Empty, CapabilityFiles.Empty, CapabilityFingerprints.Empty, CapabilityStats.Empty, CapabilitySource.Empty, CapabilityPosition.Empty])
    {
        this.BookId = BookId;
        this.VolumeId = VolumeId;
        this.CoverPageId = CoverPageId;
    }

    public Guid BookId { get; init; }
    public Guid? VolumeId { get; init; }
    public Guid? CoverPageId { get; init; }

    public BookChapter(Entity entity, Guid BookId, Guid? VolumeId, Guid? CoverPageId)
        : this(entity.Id, entity.Title, BookId, VolumeId, CoverPageId, entity.Capabilities)
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
        Guid BookId,
        Guid ChapterId,
        IReadOnlyList<ICapability>? capabilities = null)
        : base(
            Id,
            EntityKindRegistry.BookPage,
            Title,
            capabilities ?? [CapabilityImages.Empty, CapabilityFiles.Empty, CapabilityFingerprints.Empty, CapabilityTechnical.Empty, CapabilitySource.Empty, CapabilityPosition.Empty])
    {
        this.BookId = BookId;
        this.ChapterId = ChapterId;
    }

    public Guid BookId { get; init; }
    public Guid ChapterId { get; init; }

    public BookPage(Entity entity, Guid BookId, Guid ChapterId)
        : this(entity.Id, entity.Title, BookId, ChapterId, entity.Capabilities)
    {
    }
}

using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Domain model for an album, audiobook, podcast, or other audio grouping.
/// </summary>
public sealed record AudioLibrary : Entity
{
    /// <summary>
    /// Creates an audio library with explicit shared capabilities.
    /// </summary>
    public AudioLibrary(
        Guid Id,
        string Title,
        Guid? ParentLibraryId,
        IReadOnlyList<ICapability>? capabilities = null)
        : base(
            Id,
            EntityKindRegistry.AudioLibrary,
            Title,
            capabilities ??
            [
                new CapabilityRating(null),
                CapabilityTags.Empty,
                CapabilityCredits.Empty,
                new CapabilityStudio(null),
                CapabilityImages.Empty,
                CapabilityLinks.Empty,
                CapabilityFlags.Empty,
                CapabilityFiles.Empty
            ])
    {
        this.ParentLibraryId = ParentLibraryId;
    }

    /// <summary>Optional parent audio library entity identifier for nested album/library structures.</summary>
    public Guid? ParentLibraryId { get; init; }

    /// <summary>
    /// Creates an audio library from an already hydrated entity root.
    /// </summary>
    public AudioLibrary(Entity entity, Guid? ParentLibraryId)
        : this(entity.Id, entity.Title, ParentLibraryId, entity.Capabilities)
    {
    }
}

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
        IReadOnlyList<ICapability>? capabilities = null)
        : base(
            Id,
            EntityKindRegistry.AudioLibrary,
            Title,
            capabilities ??
            [
                new CapabilityRating(null),
                CapabilityImages.Empty,
                CapabilityLinks.Empty,
                CapabilityFlags.Empty,
                CapabilityFiles.Empty
            ])
    {
    }

    /// <summary>
    /// Creates an audio library from an already hydrated entity root.
    /// </summary>
    public AudioLibrary(Entity entity)
        : this(entity.Id, entity.Title, entity.Capabilities)
    {
    }
}

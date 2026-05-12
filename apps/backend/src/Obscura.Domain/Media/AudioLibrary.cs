using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Domain model for an album, audiobook, podcast, or other audio grouping.
/// </summary>
public sealed record AudioLibrary(
    Guid Id,
    string Title,
    string? Subtitle,
    AudioLibraryDetails Details)
    : Entity(
        Id,
        EntityKindRegistry.AudioLibrary,
        Title,
        Subtitle,
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
    /// <summary>
    /// Creates an audio library from an already hydrated entity root.
    /// </summary>
    public AudioLibrary(Entity entity, AudioLibraryDetails details)
        : this(entity.Id, entity.Title, entity.Subtitle, details)
    {
        Capabilities = entity.Capabilities;
    }

    /// <summary>
    /// Returns a copy of the audio library with updated audio-library-specific metadata.
    /// </summary>
    public AudioLibrary WithDetails(AudioLibraryDetails details) => this with { Details = details };
}

/// <summary>
/// Audio-library-specific metadata that should not live on every entity.
/// </summary>
public sealed record AudioLibraryDetails(
    string? Summary,
    string? Date,
    string? FolderPath,
    Guid? ParentLibraryId,
    int TrackCount)
{
    /// <summary>
    /// Empty audio library details used before scan metadata is attached.
    /// </summary>
    public static AudioLibraryDetails Empty { get; } = new(null, null, null, null, 0);
}

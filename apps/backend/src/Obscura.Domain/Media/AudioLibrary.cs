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
    EntityCapabilities Capabilities,
    AudioLibraryDetails Details)
    : Entity(Id, IEntityKind.AudioLibrary, Title, Subtitle, Capabilities)
{
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

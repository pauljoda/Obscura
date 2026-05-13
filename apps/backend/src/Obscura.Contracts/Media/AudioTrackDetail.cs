using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Media;

/// <summary>
/// API-facing detail shape for a playable audio track.
/// </summary>
/// <param name="Id">Audio track entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Audio track title.</param>
/// <param name="Capabilities">Shared entity capabilities projected for the track.</param>
/// <param name="EmbeddedArtist">Artist value read from embedded audio tags, when known.</param>
/// <param name="EmbeddedAlbum">Album value read from embedded audio tags, when known.</param>
public sealed record AudioTrackDetail(
    Guid Id,
    string Kind,
    string Title,
    IReadOnlyList<EntityCapability> Capabilities,
    string? EmbeddedArtist,
    string? EmbeddedAlbum);

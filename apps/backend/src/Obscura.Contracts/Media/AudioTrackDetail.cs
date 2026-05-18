using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Media;

/// <summary>
/// API-facing detail shape for a playable audio track.
/// </summary>
/// <param name="Id">Audio track entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Audio track title.</param>
/// <param name="ParentEntityId">Structural parent entity identifier, when this track belongs to a library.</param>
/// <param name="Capabilities">Shared entity capabilities projected for the track.</param>
/// <param name="ChildrenByKind">Generic child groups keyed by entity kind.</param>
/// <param name="EmbeddedArtist">Artist value read from embedded audio tags, when known.</param>
/// <param name="EmbeddedAlbum">Album value read from embedded audio tags, when known.</param>
public sealed record AudioTrackDetail(
    Guid Id,
    string Kind,
    string Title,
    Guid? ParentEntityId,
    int? SortOrder,
    IReadOnlyList<EntityCapability> Capabilities,
    IReadOnlyList<EntityGroup> ChildrenByKind,
    IReadOnlyList<EntityGroup> Relationships,
    string? EmbeddedArtist,
    string? EmbeddedAlbum);

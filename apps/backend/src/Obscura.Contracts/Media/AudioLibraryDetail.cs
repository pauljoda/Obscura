using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Media;

/// <summary>
/// API-facing detail shape for an album, audiobook, podcast, or other audio grouping.
/// </summary>
/// <param name="Id">Audio library entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Audio library title.</param>
/// <param name="Capabilities">Shared entity capabilities projected for the audio library.</param>
/// <param name="Children">Projected audio track children in playback order.</param>
public sealed record AudioLibraryDetail(
    Guid Id,
    string Kind,
    string Title,
    IReadOnlyList<EntityCapability> Capabilities,
    IReadOnlyList<EntityCard> Children);

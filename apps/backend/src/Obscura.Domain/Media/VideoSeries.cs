using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Media aggregate for a video series plus its projected child entities and playable videos.
/// </summary>
/// <param name="Entity">Shared global entity root for the series.</param>
/// <param name="Summary">Optional series summary.</param>
/// <param name="Children">Non-video child groupings such as seasons, once they are projected.</param>
/// <param name="Videos">Playable video entities linked to the series.</param>
/// <param name="RenderingMode">UI hint describing whether the series should render as flat or season-grouped.</param>
public sealed record VideoSeries(
    Entity Entity,
    string? Summary,
    IReadOnlyList<Entity> Children,
    IReadOnlyList<Entity> Videos,
    string RenderingMode);

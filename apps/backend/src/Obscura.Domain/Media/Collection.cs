using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Domain aggregate for a user collection plus its ordered member entities.
/// </summary>
/// <param name="Entity">Shared global entity root for the collection.</param>
/// <param name="Details">Collection-specific display and refresh metadata.</param>
/// <param name="Items">Projected collection members in relationship order.</param>
public sealed record Collection(
    Entity Entity,
    CollectionDetails Details,
    IReadOnlyList<Entity> Items);

/// <summary>
/// Collection-specific metadata that should not live on every entity.
/// </summary>
/// <param name="Description">Freeform collection description.</param>
/// <param name="Mode">Whether items are manually managed or rule-driven.</param>
/// <param name="RuleTreeJson">Stored rule tree for smart collections.</param>
/// <param name="ItemCount">Persisted member count summary.</param>
/// <param name="CoverMode">How collection artwork should be selected.</param>
/// <param name="CoverImagePath">Optional explicit collection cover path.</param>
/// <param name="CoverItemId">Optional entity whose artwork is used as the cover.</param>
/// <param name="SlideshowDuration">Per-item slideshow duration.</param>
/// <param name="SlideshowAutoAdvance">Whether slideshow mode advances automatically.</param>
/// <param name="LastRefreshedAt">Last smart-collection refresh timestamp.</param>
public sealed record CollectionDetails(
    string? Description,
    CollectionMode Mode,
    string? RuleTreeJson,
    int ItemCount,
    CollectionCoverMode CoverMode,
    string? CoverImagePath,
    Guid? CoverItemId,
    TimeSpan SlideshowDuration,
    bool SlideshowAutoAdvance,
    DateTimeOffset? LastRefreshedAt)
{
    /// <summary>
    /// Empty collection details used before collection metadata is attached.
    /// </summary>
    public static CollectionDetails Empty { get; } = new(
        null,
        CollectionMode.Manual,
        null,
        0,
        CollectionCoverMode.Mosaic,
        null,
        null,
        TimeSpan.FromSeconds(5),
        true,
        null);
}

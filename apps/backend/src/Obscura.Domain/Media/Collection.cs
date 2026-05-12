using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Domain aggregate for a user collection plus its ordered member entities.
/// </summary>
/// <param name="Id">Shared global entity identifier.</param>
/// <param name="Title">Display title inherited from the shared entity root.</param>
/// <param name="Subtitle">Optional display subtitle inherited from the shared entity root.</param>
/// <param name="Items">Projected collection members in relationship order.</param>
public sealed record Collection(
    Guid Id,
    string Title,
    string? Subtitle,
    string? Description,
    CollectionMode Mode,
    string? RuleTreeJson,
    int ItemCount,
    CollectionCoverMode CoverMode,
    string? CoverImagePath,
    Guid? CoverItemId,
    TimeSpan SlideshowDuration,
    bool SlideshowAutoAdvance,
    DateTimeOffset? LastRefreshedAt,
    IReadOnlyList<Entity> Items)
    : Entity(
        Id,
        EntityKindRegistry.Collection,
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
    /// Creates a collection from an already hydrated entity root.
    /// </summary>
    public Collection(
        Entity entity,
        string? Description,
        CollectionMode Mode,
        string? RuleTreeJson,
        int ItemCount,
        CollectionCoverMode CoverMode,
        string? CoverImagePath,
        Guid? CoverItemId,
        TimeSpan SlideshowDuration,
        bool SlideshowAutoAdvance,
        DateTimeOffset? LastRefreshedAt,
        IReadOnlyList<Entity> items)
        : this(
            entity.Id,
            entity.Title,
            entity.Subtitle,
            Description,
            Mode,
            RuleTreeJson,
            ItemCount,
            CoverMode,
            CoverImagePath,
            CoverItemId,
            SlideshowDuration,
            SlideshowAutoAdvance,
            LastRefreshedAt,
            items)
    {
        Capabilities = entity.Capabilities;
    }
}

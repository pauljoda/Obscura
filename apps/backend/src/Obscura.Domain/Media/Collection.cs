using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Domain aggregate for a user collection plus its ordered member entities.
/// </summary>
public sealed record Collection : Entity
{
    /// <summary>
    /// Creates a collection with explicit shared capabilities and collection-only behavior.
    /// </summary>
    public Collection(
        Guid Id,
        string Title,
        CollectionMode Mode,
        string? RuleTreeJson,
        CollectionCoverMode CoverMode,
        Guid? CoverItemId,
        TimeSpan SlideshowDuration,
        bool SlideshowAutoAdvance,
        DateTimeOffset? LastRefreshedAt,
        IReadOnlyList<Entity> Items,
        IReadOnlyList<ICapability>? capabilities = null)
        : base(
            Id,
            EntityKindRegistry.Collection,
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
        this.Mode = Mode;
        this.RuleTreeJson = RuleTreeJson;
        this.CoverMode = CoverMode;
        this.CoverItemId = CoverItemId;
        this.SlideshowDuration = SlideshowDuration;
        this.SlideshowAutoAdvance = SlideshowAutoAdvance;
        this.LastRefreshedAt = LastRefreshedAt;
        this.Items = Items;
    }

    public CollectionMode Mode { get; init; }
    public string? RuleTreeJson { get; init; }
    public CollectionCoverMode CoverMode { get; init; }
    public Guid? CoverItemId { get; init; }
    public TimeSpan SlideshowDuration { get; init; }
    public bool SlideshowAutoAdvance { get; init; }
    public DateTimeOffset? LastRefreshedAt { get; init; }
    public IReadOnlyList<Entity> Items { get; init; }

    /// <summary>
    /// Creates a collection from an already hydrated entity root.
    /// </summary>
    public Collection(
        Entity entity,
        CollectionMode Mode,
        string? RuleTreeJson,
        CollectionCoverMode CoverMode,
        Guid? CoverItemId,
        TimeSpan SlideshowDuration,
        bool SlideshowAutoAdvance,
        DateTimeOffset? LastRefreshedAt,
        IReadOnlyList<Entity> items)
        : this(
            entity.Id,
            entity.Title,
            Mode,
            RuleTreeJson,
            CoverMode,
            CoverItemId,
            SlideshowDuration,
            SlideshowAutoAdvance,
            LastRefreshedAt,
            items,
            entity.Capabilities)
    {
    }
}

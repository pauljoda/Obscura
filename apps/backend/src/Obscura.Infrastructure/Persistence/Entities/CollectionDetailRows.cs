using Obscura.Domain.Entities;

namespace Obscura.Infrastructure.Persistence.Entities;

public sealed class CollectionDetailRow
{
    public Guid EntityId { get; set; }
    public string? Description { get; set; }
    public CollectionMode Mode { get; set; } = CollectionMode.Manual;
    public string? RuleTreeJson { get; set; }
    public int ItemCount { get; set; }
    public CollectionCoverMode CoverMode { get; set; } = CollectionCoverMode.Mosaic;
    public string? CoverImagePath { get; set; }
    public Guid? CoverItemEntityId { get; set; }
    public int SlideshowDurationSeconds { get; set; } = 5;
    public bool SlideshowAutoAdvance { get; set; } = true;
    public DateTimeOffset? LastRefreshedAt { get; set; }
}

public sealed class CollectionItemDetailRow
{
    public Guid Id { get; set; }
    public Guid CollectionEntityId { get; set; }
    public Guid ItemEntityId { get; set; }
    public CollectionItemSource Source { get; set; } = CollectionItemSource.Manual;
    public int SortOrder { get; set; }
    public DateTimeOffset AddedAt { get; set; }
}

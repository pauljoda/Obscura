namespace Obscura.Contracts.Entities;

/// <summary>Compact metadata chip displayed by generic entity thumbnails.</summary>
/// <param name="Icon">Icon code from the shared thumbnail vocabulary.</param>
/// <param name="Label">Short display label.</param>
public sealed record EntityThumbnailMeta(string Icon, string Label);

/// <summary>Lightweight entity shape for grids, thumbnail strips, and relationship previews.</summary>
public sealed record EntityThumbnail(
    Guid Id,
    string Kind,
    string Title,
    Guid? ParentEntityId,
    int? SortOrder,
    string? CoverUrl,
    string HoverKind,
    string? HoverUrl,
    IReadOnlyList<EntityThumbnailMeta> Meta,
    int? Rating,
    bool IsFavorite,
    bool IsNsfw,
    bool IsOrganized);

/// <summary>API-facing grouped entities for child and relationship collections.</summary>
/// <param name="Kind">Entity kind code represented by the group.</param>
/// <param name="Label">Human-readable group label, such as Episodes, Tags, or Cast.</param>
/// <param name="Entities">Entities in deterministic display order.</param>
public sealed record EntityGroup(string Kind, string Label, IReadOnlyList<EntityThumbnail> Entities) {
    /// <summary>
    /// Relationship code represented by this group, such as <c>cast</c>, <c>studio</c>,
    /// or <c>tags</c>. Structural child groups leave this unset because their grouping
    /// is already fully described by <see cref="Kind"/>.
    /// </summary>
    public string? Code { get; init; }
}

/// <summary>Batch thumbnail request body.</summary>
/// <param name="Ids">Entity identifiers to resolve.</param>
public sealed record EntityThumbnailBatchRequest(IReadOnlyList<Guid> Ids);

/// <summary>Batch thumbnail response body.</summary>
/// <param name="Items">Resolved thumbnails in requested order where possible.</param>
public sealed record EntityThumbnailBatchResponse(IReadOnlyList<EntityThumbnail> Items);

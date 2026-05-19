namespace Obscura.Contracts.Entities;

/// <summary>
/// API-facing rating capability payload.
/// </summary>
/// <param name="Value">Rating value from 0 through 5, or null when no rating exists.</param>
public sealed record Rating(int? Value);

/// <summary>
/// API-facing external URL attached to an entity.
/// </summary>
/// <param name="Url">Absolute external URL.</param>
/// <param name="Label">Optional display label.</param>
public sealed record EntityUrl(string Url, string? Label);

/// <summary>
/// API-facing provider identifier attached to an entity.
/// </summary>
/// <param name="Provider">Provider code that owns the identifier.</param>
/// <param name="Value">Provider-specific identifier value.</param>
/// <param name="Url">Optional provider URL for direct navigation.</param>
public sealed record EntityExternalId(string Provider, string Value, string? Url);

/// <summary>Credit metadata exposed by detail routes that need character or role labels.</summary>
/// <param name="PersonId">Referenced person entity identifier.</param>
/// <param name="Role">Provider or domain role code, when known.</param>
/// <param name="Character">Character, credit subtitle, or contribution label, when known.</param>
public sealed record EntityCreditMetadata(Guid PersonId, string? Role, string? Character);

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
public sealed record EntityGroup(string Kind, string Label, IReadOnlyList<EntityThumbnail> Entities);

/// <summary>Batch thumbnail request body.</summary>
/// <param name="Ids">Entity identifiers to resolve.</param>
public sealed record EntityThumbnailBatchRequest(IReadOnlyList<Guid> Ids);

/// <summary>Batch thumbnail response body.</summary>
/// <param name="Items">Resolved thumbnails in requested order where possible.</param>
public sealed record EntityThumbnailBatchResponse(IReadOnlyList<EntityThumbnail> Items);

/// <summary>
/// Shared shape implemented by every entity card and kind-specific detail contract.
/// Carries the fields common to all entities so detail routes can be returned as a single
/// strongly typed contract instead of <see cref="object"/>.
/// </summary>
public interface IEntityCard
{
    /// <summary>Global entity identifier.</summary>
    Guid Id { get; }

    /// <summary>Entity kind code.</summary>
    string Kind { get; }

    /// <summary>Primary display title.</summary>
    string Title { get; }

    /// <summary>Structural parent entity identifier, or null for root and virtual collection children.</summary>
    Guid? ParentEntityId { get; }

    /// <summary>Optional structural order under the parent entity.</summary>
    int? SortOrder { get; }

    /// <summary>Shared capabilities already projected for the card.</summary>
    IReadOnlyList<EntityCapability> Capabilities { get; }

    /// <summary>Generic child groups keyed by entity kind.</summary>
    IReadOnlyList<EntityGroup> ChildrenByKind { get; }

    /// <summary>Generic non-structural relationship groups keyed by entity kind.</summary>
    IReadOnlyList<EntityGroup> Relationships { get; }
}

/// <summary>
/// Normalized card/detail shape used across media, taxonomy, and collection routes.
/// </summary>
/// <param name="Id">Global entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Primary display title.</param>
/// <param name="ParentEntityId">Structural parent entity identifier, or null for root and virtual collection children.</param>
/// <param name="SortOrder">Optional structural order under the parent entity.</param>
/// <param name="Capabilities">Shared capabilities already projected for the card.</param>
/// <param name="ChildrenByKind">Generic child groups keyed by entity kind.</param>
/// <param name="Relationships">Generic non-structural relationship groups keyed by entity kind.</param>
public sealed record EntityCard(
    Guid Id,
    string Kind,
    string Title,
    Guid? ParentEntityId,
    int? SortOrder,
    IReadOnlyList<EntityCapability> Capabilities,
    IReadOnlyList<EntityGroup> ChildrenByKind,
    IReadOnlyList<EntityGroup> Relationships) : IEntityCard;

/// <summary>
/// Cursor-paged entity list response.
/// </summary>
/// <param name="Items">Current page of entity cards.</param>
/// <param name="NextCursor">Cursor for the next page, or null when complete.</param>
public sealed record EntityListResponse(
    IReadOnlyList<EntityThumbnail> Items,
    string? NextCursor);

/// <summary>
/// Request body for setting or clearing an entity rating.
/// </summary>
/// <param name="Value">Rating value from 0 through 5, or null to clear the rating.</param>
public sealed record RatingUpdateRequest(int? Value);

/// <summary>
/// Request body for partially updating shared entity flags.
/// </summary>
/// <param name="IsFavorite">Optional favorite flag value.</param>
/// <param name="IsNsfw">Optional NSFW flag value.</param>
/// <param name="IsOrganized">Optional organized/reviewed flag value.</param>
public sealed record EntityFlagsUpdateRequest(
    bool? IsFavorite,
    bool? IsNsfw,
    bool? IsOrganized);

/// <summary>
/// Request body for recording or updating playback state.
/// All fields are optional — omitted fields leave the existing value unchanged.
/// </summary>
/// <param name="ResumeSeconds">Position in seconds where playback should resume next time.</param>
/// <param name="DurationSeconds">Seconds of playback to add to the total accumulated duration.</param>
/// <param name="Completed">When true, marks the entity as completed; when false, clears completion.</param>
public sealed record PlaybackUpdateRequest(
    double? ResumeSeconds,
    double? DurationSeconds,
    bool? Completed);

/// <summary>
/// Request body for creating or updating a timeline marker.
/// </summary>
/// <param name="Title">Human-readable marker label.</param>
/// <param name="Seconds">Marker start time in seconds.</param>
/// <param name="EndSeconds">Optional marker end time in seconds.</param>
public sealed record EntityMarkerWriteRequest(
    string Title,
    double Seconds,
    double? EndSeconds);

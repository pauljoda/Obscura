namespace Obscura.Contracts.Entities;

/// <summary>
/// API-facing lightweight reference to another entity.
/// </summary>
/// <param name="Id">Referenced entity identifier.</param>
/// <param name="Kind">Referenced entity kind code.</param>
/// <param name="Title">Referenced entity title.</param>
public sealed record EntityReference(Guid Id, string Kind, string Title);

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

/// <summary>
/// Normalized list-card shape used across media, taxonomy, and collection routes.
/// </summary>
/// <param name="Id">Global entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Primary display title.</param>
/// <param name="Capabilities">Shared capabilities already projected for the card.</param>
public sealed record EntityCard(
    Guid Id,
    string Kind,
    string Title,
    IReadOnlyList<EntityCapability> Capabilities);

/// <summary>
/// Cursor-paged entity list response.
/// </summary>
/// <param name="Items">Current page of entity cards.</param>
/// <param name="NextCursor">Cursor for the next page, or null when complete.</param>
public sealed record EntityListResponse(
    IReadOnlyList<EntityCard> Items,
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

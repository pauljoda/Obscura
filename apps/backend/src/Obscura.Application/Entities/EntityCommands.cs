namespace Obscura.Application.Entities;

/// <summary>
/// Use-case command for setting or clearing the rating capability on any entity kind.
/// </summary>
/// <param name="EntityId">Entity whose rating should change.</param>
/// <param name="Value">Rating value to store, or null to clear the rating.</param>
public sealed record SetEntityRatingCommand(Guid EntityId, int? Value);

/// <summary>
/// Use-case command for updating shared entity flags without forcing callers to send the full flag row.
/// </summary>
/// <param name="EntityId">Entity whose flags should change.</param>
/// <param name="IsFavorite">Optional favorite flag value.</param>
/// <param name="IsNsfw">Optional NSFW flag value.</param>
/// <param name="IsOrganized">Optional organized/reviewed flag value.</param>
public sealed record UpdateEntityFlagsCommand(
    Guid EntityId,
    bool? IsFavorite,
    bool? IsNsfw,
    bool? IsOrganized);

/// <summary>
/// Use-case command for recording a playback state change on a media entity.
/// Increments play count on the first call, updates resume position,
/// accumulates duration, and optionally marks completion.
/// </summary>
/// <param name="EntityId">Entity whose playback state should change.</param>
/// <param name="ResumeSeconds">Resume position in seconds, or null to leave unchanged.</param>
/// <param name="DurationSeconds">Seconds of playback to accumulate, or null to skip.</param>
/// <param name="Completed">When true marks completion; when false clears it; null leaves unchanged.</param>
public sealed record UpdatePlaybackCommand(
    Guid EntityId,
    double? ResumeSeconds,
    double? DurationSeconds,
    bool? Completed);

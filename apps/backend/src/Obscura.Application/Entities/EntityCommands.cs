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

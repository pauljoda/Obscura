namespace Obscura.Application.Entities;

public sealed record SetEntityRatingCommand(Guid EntityId, int? Value);

public sealed record UpdateEntityFlagsCommand(
    Guid EntityId,
    bool? IsFavorite,
    bool? IsNsfw,
    bool? IsOrganized);

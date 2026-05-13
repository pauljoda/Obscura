using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Taxonomy;

/// <summary>
/// API-facing detail shape for a studio, publisher, label, or production-group taxonomy entity.
/// </summary>
/// <param name="Id">Studio entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Studio title.</param>
/// <param name="Capabilities">Shared entity capabilities projected for the studio.</param>
/// <param name="ParentStudioId">Optional parent studio entity for hierarchies.</param>
public sealed record StudioDetail(
    Guid Id,
    string Kind,
    string Title,
    IReadOnlyList<EntityCapability> Capabilities,
    Guid? ParentStudioId);

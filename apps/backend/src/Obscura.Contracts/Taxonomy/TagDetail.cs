using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Taxonomy;

/// <summary>
/// API-facing detail shape for a tag taxonomy entity.
/// </summary>
/// <param name="Id">Tag entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Tag title.</param>
/// <param name="Capabilities">Shared entity capabilities projected for the tag.</param>
/// <param name="ParentTagId">Optional parent tag entity for hierarchies.</param>
/// <param name="IgnoreAutoTag">Whether automatic tagging should ignore this tag.</param>
public sealed record TagDetail(
    Guid Id,
    string Kind,
    string Title,
    IReadOnlyList<EntityCapability> Capabilities,
    Guid? ParentTagId,
    bool IgnoreAutoTag);

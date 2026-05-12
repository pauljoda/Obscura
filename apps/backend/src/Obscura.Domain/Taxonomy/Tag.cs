using Obscura.Domain.Entities;

namespace Obscura.Domain.Taxonomy;

/// <summary>
/// Domain model for a tag taxonomy entity.
/// </summary>
public sealed record Tag(
    Entity Entity,
    TagDetails Details)
{
    /// <summary>
    /// Returns a copy of the tag with updated tag-specific metadata.
    /// </summary>
    public Tag WithDetails(TagDetails details) => this with { Details = details };
}

/// <summary>
/// Tag-specific metadata for hierarchy and scan behavior.
/// </summary>
/// <param name="Description">Freeform tag description.</param>
/// <param name="ParentTagId">Optional parent tag entity identifier.</param>
/// <param name="IgnoreAutoTag">Whether scanner/provider automation should avoid applying the tag automatically.</param>
public sealed record TagDetails(string? Description, Guid? ParentTagId, bool IgnoreAutoTag)
{
    /// <summary>
    /// Empty tag details used before metadata is attached.
    /// </summary>
    public static TagDetails Empty { get; } = new(null, null, false);
}

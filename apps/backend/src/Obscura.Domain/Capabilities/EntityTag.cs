using Obscura.Domain.Entities;

namespace Obscura.Domain.Capabilities;

/// <summary>
/// One tag attached to an entity, preserving the tag entity reference instead of only its display text.
/// </summary>
/// <param name="Reference">Referenced tag entity.</param>
public sealed record EntityTag(EntityReference Reference);

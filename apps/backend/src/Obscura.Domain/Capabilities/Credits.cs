using Obscura.Domain.Entities;

namespace Obscura.Domain.Capabilities;

/// <summary>
/// Represents people credited on an entity, such as performers, actors, artists, or authors.
/// </summary>
/// <param name="People">Ordered references to credited people entities.</param>
public sealed record Credits(IReadOnlyList<EntityReference> People)
{
    /// <summary>
    /// A reusable empty credits set for entities with no projected people credits.
    /// </summary>
    public static Credits Empty { get; } = new([]);
}

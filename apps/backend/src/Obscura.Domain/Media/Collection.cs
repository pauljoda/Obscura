using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Media aggregate for a user-curated collection and the entities it contains.
/// </summary>
/// <param name="Entity">Shared global entity root for the collection.</param>
/// <param name="Items">Entities linked into the collection.</param>
public sealed record Collection(Entity Entity, IReadOnlyList<Entity> Items);

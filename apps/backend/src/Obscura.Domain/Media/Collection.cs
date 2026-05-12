using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

public sealed record Collection(Entity Entity, IReadOnlyList<Entity> Items);

using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

public sealed record Gallery(Entity Entity, IReadOnlyList<Entity> Images);

using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

public sealed record AudioLibrary(Entity Entity, IReadOnlyList<Entity> Tracks);

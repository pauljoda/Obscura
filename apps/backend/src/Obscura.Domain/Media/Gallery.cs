using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Media aggregate for a gallery and the image entities displayed inside it.
/// </summary>
/// <param name="Entity">Shared global entity root for the gallery.</param>
/// <param name="Images">Image entities that belong to the gallery.</param>
public sealed record Gallery(Entity Entity, IReadOnlyList<Entity> Images);

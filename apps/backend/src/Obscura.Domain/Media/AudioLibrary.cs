using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Media aggregate for an audio library or album-like entity and its tracks.
/// </summary>
/// <param name="Entity">Shared global entity root for the audio library.</param>
/// <param name="Tracks">Track entities that belong to the library.</param>
public sealed record AudioLibrary(Entity Entity, IReadOnlyList<Entity> Tracks);

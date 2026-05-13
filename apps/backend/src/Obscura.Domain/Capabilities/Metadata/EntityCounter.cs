namespace Obscura.Domain.Capabilities;

/// <summary>
/// Stores a named integer count attached to an entity, such as a video-specific event counter.
/// </summary>
/// <param name="Code">Stable counter code, for example <c>orgasm</c>.</param>
/// <param name="Value">Non-negative counter value.</param>
public sealed record EntityCounter(string Code, int Value);

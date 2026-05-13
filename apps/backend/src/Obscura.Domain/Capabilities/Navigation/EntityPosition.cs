namespace Obscura.Domain.Capabilities;

/// <summary>
/// Structural ordering or label value attached to an entity.
/// </summary>
/// <param name="Code">Stable position code, such as season, volume, chapter, page, track, or sort.</param>
/// <param name="Value">Numeric position value.</param>
/// <param name="Label">Optional display label when the numeric value is not enough for UI.</param>
public sealed record EntityPosition(string Code, int Value, string? Label = null);

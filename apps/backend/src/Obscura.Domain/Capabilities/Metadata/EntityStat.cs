namespace Obscura.Domain.Capabilities;

/// <summary>
/// Named stored or derived inventory statistic attached to an entity.
/// </summary>
/// <param name="Code">Stable statistic code, such as images, tracks, pages, chapters, or items.</param>
/// <param name="Value">Non-negative statistic value.</param>
public sealed record EntityStat(string Code, int Value);

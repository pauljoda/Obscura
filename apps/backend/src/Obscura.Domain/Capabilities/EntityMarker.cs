namespace Obscura.Domain.Capabilities;

/// <summary>
/// Marks a named time range or point inside time-based media such as video or audio.
/// </summary>
/// <param name="Id">Stable marker identifier.</param>
/// <param name="Title">Human-readable marker label.</param>
/// <param name="Seconds">Start time in seconds from the beginning of the media.</param>
/// <param name="EndSeconds">Optional end time in seconds when the marker spans a range.</param>
public sealed record EntityMarker(Guid Id, string Title, double Seconds, double? EndSeconds);

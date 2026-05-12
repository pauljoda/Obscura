namespace Obscura.Domain.Capabilities;

/// <summary>
/// Groups timeline markers for media that can be scrubbed or segmented.
/// </summary>
/// <param name="Items">Ordered timeline markers attached to the media entity.</param>
public sealed record Markers(IReadOnlyList<EntityMarker> Items)
{
    /// <summary>
    /// A reusable empty marker set for media without timeline annotations.
    /// </summary>
    public static Markers Empty { get; } = new([]);
}

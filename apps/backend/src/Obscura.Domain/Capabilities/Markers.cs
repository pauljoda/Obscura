namespace Obscura.Domain.Capabilities;

public sealed record Markers(IReadOnlyList<EntityMarker> Items)
{
    public static Markers Empty { get; } = new([]);
}

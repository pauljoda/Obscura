namespace Obscura.Domain.Capabilities;

public sealed record Subtitles(IReadOnlyList<EntitySubtitle> Items)
{
    public static Subtitles Empty { get; } = new([]);
}

namespace Obscura.Domain.Capabilities;

public sealed record Tags(IReadOnlyList<string> Values)
{
    public static Tags Empty { get; } = new([]);
}

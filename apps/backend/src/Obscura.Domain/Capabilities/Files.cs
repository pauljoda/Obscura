namespace Obscura.Domain.Capabilities;

public sealed record Files(IReadOnlyList<EntityFile> Items)
{
    public static Files Empty { get; } = new([]);
}

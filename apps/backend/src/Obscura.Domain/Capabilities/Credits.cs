using Obscura.Domain.Entities;

namespace Obscura.Domain.Capabilities;

public sealed record Credits(IReadOnlyList<EntityReference> People)
{
    public static Credits Empty { get; } = new([]);
}

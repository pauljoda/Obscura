namespace Obscura.Domain.Capabilities;

public sealed record EntityFlags(bool? IsFavorite, bool? IsNsfw, bool? IsOrganized)
{
    public static EntityFlags Empty { get; } = new(null, null, null);
}

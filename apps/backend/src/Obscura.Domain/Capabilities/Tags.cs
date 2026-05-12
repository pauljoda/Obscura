namespace Obscura.Domain.Capabilities;

/// <summary>
/// Represents the shared tag capability as user-facing tag names.
/// </summary>
/// <param name="Values">Sorted tag names attached to the entity.</param>
public sealed record Tags(IReadOnlyList<string> Values)
{
    /// <summary>
    /// A reusable empty tag set for untagged entities.
    /// </summary>
    public static Tags Empty { get; } = new([]);
}

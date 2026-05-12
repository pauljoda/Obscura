namespace Obscura.Domain.Capabilities;

/// <summary>
/// Represents user-editable boolean state shared by all entity kinds.
/// </summary>
/// <param name="IsFavorite">Whether the entity is marked as a favorite.</param>
/// <param name="IsNsfw">Whether the entity should be treated as adult or hidden in SFW mode.</param>
/// <param name="IsOrganized">Whether the entity has been reviewed and accepted into the organized library.</param>
public sealed record EntityFlags(bool? IsFavorite, bool? IsNsfw, bool? IsOrganized)
{
    /// <summary>
    /// A reusable flags value for entities with no explicit flag row.
    /// </summary>
    public static EntityFlags Empty { get; } = new(null, null, null);
}

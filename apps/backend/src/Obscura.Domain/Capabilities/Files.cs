namespace Obscura.Domain.Capabilities;

/// <summary>
/// Groups file attachments for an entity so file handling can be reused across media kinds.
/// </summary>
/// <param name="Items">Projected files attached to the entity.</param>
public sealed record Files(IReadOnlyList<EntityFile> Items)
{
    /// <summary>
    /// A reusable empty file set for entities without file-backed assets.
    /// </summary>
    public static Files Empty { get; } = new([]);
}

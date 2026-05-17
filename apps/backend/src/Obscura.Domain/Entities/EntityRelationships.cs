namespace Obscura.Domain.Entities;

/// <summary>
/// One entity reference inside a generic relationship group.
/// </summary>
/// <param name="EntityId">Referenced entity identifier.</param>
/// <param name="MetadataJson">Optional edge metadata for detail routes that need relationship-specific labels.</param>
public sealed record EntityRelationshipItem(Guid EntityId, string? MetadataJson);

/// <summary>
/// A generic non-structural relationship group from one entity to referenced entities.
/// </summary>
/// <param name="Code">Stable relationship code such as tags, studio, cast, or artists.</param>
/// <param name="Kind">Target entity kind represented by the group.</param>
/// <param name="Label">Human-readable label for UI sections.</param>
/// <param name="Items">Referenced entity identifiers and optional edge metadata in display order.</param>
public sealed record EntityRelationshipGroup(
    string Code,
    IEntityKind Kind,
    string Label,
    IReadOnlyList<EntityRelationshipItem> Items);

/// <summary>
/// Relationship groups attached to an entity without using relationship-code string indexing in callers.
/// </summary>
public sealed class EntityRelationships
{
    /// <summary>A reusable empty relationship projection.</summary>
    public static EntityRelationships Empty { get; } = new([]);

    /// <summary>
    /// Creates a relationship projection from pre-grouped references.
    /// </summary>
    /// <param name="groups">Relationship groups in deterministic display order.</param>
    public EntityRelationships(IReadOnlyList<EntityRelationshipGroup> groups)
    {
        ArgumentNullException.ThrowIfNull(groups);
        Groups = groups
            .Select(group => group with { Items = group.Items.ToArray() })
            .ToArray();
    }

    /// <summary>All relationship groups in deterministic display order.</summary>
    public IReadOnlyList<EntityRelationshipGroup> Groups { get; }
}

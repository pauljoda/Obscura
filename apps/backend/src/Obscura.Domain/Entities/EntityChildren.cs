namespace Obscura.Domain.Entities;

/// <summary>
/// One typed child group for an entity graph projection.
/// </summary>
/// <param name="Kind">Kind represented by this group.</param>
/// <param name="Items">Child entities in deterministic display order.</param>
public sealed record EntityChildSet(IEntityKind Kind, IReadOnlyList<Entity> Items)
{
    /// <summary>
    /// Returns this child group as a typed list for callers that already know the requested kind.
    /// </summary>
    /// <typeparam name="TEntity">Entity type represented by the requested kind.</typeparam>
    /// <param name="kind">Typed entity kind expected for this set.</param>
    /// <returns>Typed child entities.</returns>
    public IReadOnlyList<TEntity> Get<TEntity>(IEntityKind<TEntity> kind)
        where TEntity : Entity
    {
        ArgumentNullException.ThrowIfNull(kind);
        if (!string.Equals(Kind.Code, kind.Code, StringComparison.OrdinalIgnoreCase))
        {
            return [];
        }

        return Items.OfType<TEntity>().ToArray();
    }
}

/// <summary>
/// Typed child groups for an entity, indexed internally by entity-kind code but exposed without string indexing.
/// </summary>
public sealed class EntityChildren
{
    private readonly IReadOnlyDictionary<string, EntityChildSet> _setsByKind;

    /// <summary>A reusable empty child projection.</summary>
    public static EntityChildren Empty { get; } = new([]);

    /// <summary>
    /// Creates a child projection from grouped child sets.
    /// </summary>
    /// <param name="sets">Child groups keyed by entity kind.</param>
    /// <exception cref="ArgumentException">Thrown when more than one child group has the same kind code.</exception>
    public EntityChildren(IReadOnlyList<EntityChildSet> sets)
    {
        ArgumentNullException.ThrowIfNull(sets);

        var duplicates = sets
            .GroupBy(set => set.Kind.Code, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToArray();
        if (duplicates.Length > 0)
        {
            throw new ArgumentException(
                $"Entity children contain duplicate kind codes: {string.Join(", ", duplicates)}.",
                nameof(sets));
        }

        Sets = sets
            .Select(set => set with { Items = set.Items.ToArray() })
            .ToArray();
        _setsByKind = Sets.ToDictionary(set => set.Kind.Code, StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>All child groups in deterministic projection order.</summary>
    public IReadOnlyList<EntityChildSet> Sets { get; }

    /// <summary>
    /// Gets children for a typed entity kind without exposing string-keyed dictionary access to app code.
    /// </summary>
    /// <typeparam name="TEntity">Entity type represented by the requested kind.</typeparam>
    /// <param name="kind">Typed entity kind to retrieve.</param>
    /// <returns>Matching children, or an empty list when the entity has none.</returns>
    public IReadOnlyList<TEntity> Get<TEntity>(IEntityKind<TEntity> kind)
        where TEntity : Entity
    {
        ArgumentNullException.ThrowIfNull(kind);
        return _setsByKind.TryGetValue(kind.Code, out var set) ? set.Get(kind) : [];
    }
}

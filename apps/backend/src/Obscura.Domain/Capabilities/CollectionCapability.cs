namespace Obscura.Domain.Capabilities;

/// <summary>
/// Base class for capabilities whose state is a single keyed collection of value objects.
/// Every item must satisfy <see cref="ICapabilityItem{TKey}" />, so identity-based behavior
/// (find, contains, replace-by-key, remove-by-key) is implemented once here and concrete
/// capabilities only add domain-specific operations.
/// </summary>
/// <typeparam name="TItem">Value object type held by the capability.</typeparam>
/// <typeparam name="TKey">Stable identity type each item exposes through its key.</typeparam>
public abstract class CollectionCapability<TItem, TKey> : EntityCapability
    where TItem : class, ICapabilityItem<TKey> {
    private readonly List<TItem> _items;
    private readonly IEqualityComparer<TKey> _keyComparer;

    /// <summary>
    /// Creates the capability with an optional initial item list.
    /// </summary>
    /// <param name="items">Initial items, or null for an empty capability.</param>
    /// <param name="keyComparer">Comparer used for key identity, or null for the default comparer.</param>
    protected CollectionCapability(IEnumerable<TItem>? items = null, IEqualityComparer<TKey>? keyComparer = null) {
        _keyComparer = keyComparer ?? EqualityComparer<TKey>.Default;
        _items = items is null ? [] : [.. items];
    }

    /// <summary>Immutable view of the items held by this capability in current order.</summary>
    public IReadOnlyList<TItem> Items => _items;

    /// <summary>Finds the first item with the supplied key, or null when none matches.</summary>
    /// <param name="key">Item key to look up.</param>
    public TItem? Find(TKey key) =>
        _items.FirstOrDefault(item => _keyComparer.Equals(item.Key, key));

    /// <summary>Checks whether any item has the supplied key.</summary>
    /// <param name="key">Item key to look up.</param>
    public bool Contains(TKey key) =>
        _items.Any(item => _keyComparer.Equals(item.Key, key));

    /// <summary>
    /// Adds the item, replacing any existing item that shares its key.
    /// </summary>
    /// <param name="item">Item to add or replace.</param>
    public void Set(TItem item) {
        ArgumentNullException.ThrowIfNull(item);
        _items.RemoveAll(existing => _keyComparer.Equals(existing.Key, item.Key));
        _items.Add(item);
    }

    /// <summary>Removes every item with the supplied key.</summary>
    /// <param name="key">Item key to remove.</param>
    /// <returns>True when at least one item was removed.</returns>
    public bool Remove(TKey key) =>
        _items.RemoveAll(item => _keyComparer.Equals(item.Key, key)) > 0;

    /// <summary>Appends an item without key deduplication.</summary>
    /// <param name="item">Item to append.</param>
    protected void AddItem(TItem item) {
        ArgumentNullException.ThrowIfNull(item);
        _items.Add(item);
    }

    /// <summary>Removes every item matching the predicate.</summary>
    /// <param name="match">Predicate selecting items to remove.</param>
    /// <returns>The number of items removed.</returns>
    protected int RemoveItems(Predicate<TItem> match) {
        ArgumentNullException.ThrowIfNull(match);
        return _items.RemoveAll(match);
    }

    /// <summary>Replaces the entire collection with the supplied items.</summary>
    /// <param name="items">Replacement items.</param>
    protected void ReplaceAll(IEnumerable<TItem> items) {
        ArgumentNullException.ThrowIfNull(items);
        _items.Clear();
        _items.AddRange(items);
    }

    /// <summary>Re-sorts the collection in place using the supplied key.</summary>
    /// <typeparam name="TSortKey">Sort key type.</typeparam>
    /// <param name="keySelector">Projects each item to its sort key.</param>
    protected void SortBy<TSortKey>(Func<TItem, TSortKey> keySelector) {
        ArgumentNullException.ThrowIfNull(keySelector);
        var ordered = _items.OrderBy(keySelector).ToArray();
        _items.Clear();
        _items.AddRange(ordered);
    }
}

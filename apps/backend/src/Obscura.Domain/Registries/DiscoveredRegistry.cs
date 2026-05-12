using System.Reflection;

namespace Obscura.Domain.Registries;

/// <summary>
/// Base implementation for registries that discover domain values from public parameterless implementations.
/// </summary>
/// <typeparam name="TItem">Contract implemented by each discovered registry value.</typeparam>
/// <typeparam name="TKey">Stable key type used to look up a registered value.</typeparam>
public abstract class DiscoveredRegistry<TItem, TKey>
    where TKey : notnull
{
    private readonly Assembly _assembly;
    private readonly Func<TItem, TKey> _keySelector;
    private readonly IEqualityComparer<TKey>? _keyComparer;
    private readonly Lazy<IReadOnlyList<TItem>> _items;
    private readonly Lazy<IReadOnlyDictionary<TKey, TItem>> _itemsByKey;

    /// <summary>
    /// Creates a registry that scans an assembly for concrete implementations of <typeparamref name="TItem" />.
    /// </summary>
    /// <param name="assembly">Assembly containing the registry value implementations.</param>
    /// <param name="keySelector">Function that extracts the stable lookup key from each item.</param>
    /// <param name="keyComparer">Optional comparer for lookup keys.</param>
    protected DiscoveredRegistry(
        Assembly assembly,
        Func<TItem, TKey> keySelector,
        IEqualityComparer<TKey>? keyComparer = null)
    {
        _assembly = assembly;
        _keySelector = keySelector;
        _keyComparer = keyComparer;
        _items = new Lazy<IReadOnlyList<TItem>>(DiscoverItems);
        _itemsByKey = new Lazy<IReadOnlyDictionary<TKey, TItem>>(() => Items.ToDictionary(_keySelector, _keyComparer));
    }

    /// <summary>
    /// Gets every discovered registry item in deterministic order.
    /// </summary>
    protected IReadOnlyList<TItem> Items => _items.Value;

    /// <summary>
    /// Attempts to look up a discovered item by key.
    /// </summary>
    /// <param name="key">Stable lookup key.</param>
    /// <param name="item">The registered item when the method returns true.</param>
    /// <returns><see langword="true" /> when the key is registered; otherwise <see langword="false" />.</returns>
    protected bool TryGetItem(TKey key, out TItem item) => _itemsByKey.Value.TryGetValue(key, out item!);

    /// <summary>
    /// Looks up a discovered item by key and throws a domain-specific exception when it is missing.
    /// </summary>
    /// <param name="key">Stable lookup key.</param>
    /// <param name="createErrorMessage">Function that creates the missing-key error message.</param>
    /// <returns>The registered item for the key.</returns>
    protected TItem RequireItem(TKey key, Func<TKey, string> createErrorMessage)
    {
        if (TryGetItem(key, out var item))
        {
            return item;
        }

        throw new InvalidOperationException(createErrorMessage(key));
    }

    /// <summary>
    /// Determines whether a type should be created as a registry item.
    /// </summary>
    /// <param name="type">Type discovered from the registry assembly.</param>
    /// <returns><see langword="true" /> when the type is a concrete item implementation.</returns>
    protected virtual bool IsDiscoverableType(Type type) =>
        !type.IsAbstract &&
        !type.IsInterface &&
        typeof(TItem).IsAssignableFrom(type) &&
        type.GetConstructor(BindingFlags.Public | BindingFlags.Instance, Type.EmptyTypes) is not null;

    /// <summary>
    /// Creates a registry item from a discoverable type.
    /// </summary>
    /// <param name="type">Concrete type to instantiate.</param>
    /// <returns>Created registry item.</returns>
    protected virtual TItem CreateItem(Type type) => (TItem)Activator.CreateInstance(type)!;

    /// <summary>
    /// Orders discovered items before they are exposed by the registry.
    /// </summary>
    /// <param name="items">Discovered items.</param>
    /// <returns>Items in registry order.</returns>
    protected virtual IEnumerable<TItem> OrderItems(IEnumerable<TItem> items) => items;

    private IReadOnlyList<TItem> DiscoverItems() =>
        OrderItems(_assembly.GetTypes()
            .Where(IsDiscoverableType)
            .Select(CreateItem))
        .ToArray();
}

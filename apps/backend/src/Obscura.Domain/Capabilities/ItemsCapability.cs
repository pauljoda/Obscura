namespace Obscura.Domain.Capabilities;

/// <summary>
/// Base class for capabilities whose entire state is an immutable list of value objects.
/// Removes the repeated constructor/Items boilerplate from the data-only holders.
/// </summary>
/// <typeparam name="TItem">Value object type held by the capability.</typeparam>
public abstract class ItemsCapability<TItem> : EntityCapability {
    /// <summary>
    /// Creates the capability with an optional initial item list.
    /// </summary>
    /// <param name="items">Initial items, or null for an empty capability.</param>
    protected ItemsCapability(IReadOnlyList<TItem>? items) {
        Items = items?.ToArray() ?? [];
    }

    /// <summary>Immutable items held by this capability.</summary>
    public IReadOnlyList<TItem> Items { get; }
}

namespace Obscura.Domain.Capabilities;

/// <summary>
/// Contract every item held by a <see cref="CollectionCapability{TItem,TKey}" /> must satisfy.
/// The key is the stable identity the capability uses to find, dedupe, and replace items,
/// so shared collection behavior can be implemented once on the base instead of relying on
/// each capability to reimplement it.
/// </summary>
/// <typeparam name="TKey">Type of the stable identity for this item.</typeparam>
public interface ICapabilityItem<TKey> {
    /// <summary>Stable identity used to find, dedupe, and replace this item within its capability.</summary>
    TKey Key { get; }
}

namespace Obscura.Domain.Entities;

/// <summary>
/// Closed set of collection population strategies.
/// </summary>
public enum CollectionMode {
    /// <summary>User-managed collection membership.</summary>
    Manual,

    /// <summary>Collection membership produced from stored rules.</summary>
    Dynamic,

    /// <summary>Collection combines manually pinned items with rule-produced items.</summary>
    Hybrid
}

/// <summary>
/// Codec for collection population mode codes.
/// </summary>
public sealed class CollectionModeCodec : EnumCodec<CollectionMode> {
    public CollectionModeCodec()
        : base(new Dictionary<CollectionMode, string> {
            [CollectionMode.Manual] = "manual",
            [CollectionMode.Dynamic] = "dynamic",
            [CollectionMode.Hybrid] = "hybrid"
        }) {
    }
}

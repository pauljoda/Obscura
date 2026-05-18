namespace Obscura.Domain.Entities;

/// <summary>
/// Closed set of collection cover generation strategies.
/// </summary>
public enum CollectionCoverMode {
    /// <summary>Cover generated from multiple collection items.</summary>
    Mosaic,

    /// <summary>Cover supplied by an uploaded or generated image path.</summary>
    Custom,

    /// <summary>Cover borrowed from a specific collection item.</summary>
    Item
}

/// <summary>
/// Codec for collection cover mode codes.
/// </summary>
public sealed class CollectionCoverModeCodec : EnumCodec<CollectionCoverMode> {
    public CollectionCoverModeCodec()
        : base(new Dictionary<CollectionCoverMode, string> {
            [CollectionCoverMode.Mosaic] = "mosaic",
            [CollectionCoverMode.Custom] = "custom",
            [CollectionCoverMode.Item] = "item"
        }) {
    }
}

namespace Obscura.Domain.Entities;

/// <summary>
/// Closed set of reasons an item appears inside a collection.
/// </summary>
public enum CollectionItemSource
{
    /// <summary>The user explicitly added the item.</summary>
    Manual,

    /// <summary>A collection rule selected the item.</summary>
    Dynamic
}

/// <summary>
/// Codec for collection item source codes.
/// </summary>
public sealed class CollectionItemSourceCodec : EnumCodec<CollectionItemSource>
{
    public CollectionItemSourceCodec()
        : base(new Dictionary<CollectionItemSource, string>
        {
            [CollectionItemSource.Manual] = "manual",
            [CollectionItemSource.Dynamic] = "dynamic"
        })
    {
    }
}

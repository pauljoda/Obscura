namespace Obscura.Domain.Entities;

/// <summary>
/// Filesystem storage shape used by scan and organize rules for an entity kind.
/// </summary>
public enum EntityStorageShape
{
    /// <summary>Entity has no direct filesystem storage representation.</summary>
    None,

    /// <summary>Entity owns a directory under its parent.</summary>
    Folder,

    /// <summary>Entity is represented by a regular file.</summary>
    File,

    /// <summary>Entity is represented by an archive file.</summary>
    Archive,

    /// <summary>Entity is an addressable item inside an archive and is not moved independently.</summary>
    ArchiveEntry
}

/// <summary>
/// Codec for persisting entity storage-shape codes.
/// </summary>
public sealed class EntityStorageShapeCodec : EnumCodec<EntityStorageShape>
{
    public EntityStorageShapeCodec()
        : base(new Dictionary<EntityStorageShape, string>
        {
            [EntityStorageShape.None] = "none",
            [EntityStorageShape.Folder] = "folder",
            [EntityStorageShape.File] = "file",
            [EntityStorageShape.Archive] = "archive",
            [EntityStorageShape.ArchiveEntry] = "archive-entry"
        })
    {
    }
}

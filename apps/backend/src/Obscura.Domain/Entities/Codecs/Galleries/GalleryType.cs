namespace Obscura.Domain.Entities;

/// <summary>
/// Closed set of gallery storage shapes known to Obscura.
/// </summary>
public enum GalleryType
{
    /// <summary>Gallery assembled from existing image entities or metadata without one source folder.</summary>
    Virtual,

    /// <summary>Gallery discovered from a filesystem folder.</summary>
    Folder,

    /// <summary>Gallery discovered from a zip or comic archive file.</summary>
    Zip
}

/// <summary>
/// Codec for gallery storage shape codes.
/// </summary>
public sealed class GalleryTypeCodec : EnumCodec<GalleryType>
{
    public GalleryTypeCodec()
        : base(new Dictionary<GalleryType, string>
        {
            [GalleryType.Virtual] = "virtual",
            [GalleryType.Folder] = "folder",
            [GalleryType.Zip] = "zip"
        })
    {
    }
}

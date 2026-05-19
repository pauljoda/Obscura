namespace Obscura.Domain.Entities;

/// <summary>
/// Closed set of gallery storage shapes known to Obscura.
/// </summary>
public enum GalleryType {
    /// <summary>Gallery assembled from existing image entities or metadata without one source folder.</summary>
    [Code("virtual")]
    Virtual,

    /// <summary>Gallery discovered from a filesystem folder.</summary>
    [Code("folder")]
    Folder,

    /// <summary>Gallery discovered from a zip or comic archive file.</summary>
    [Code("zip")]
    Zip
}

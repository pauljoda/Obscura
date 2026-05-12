namespace Obscura.Contracts.System;

/// <summary>
/// Summary returned after importing legacy non-video media into the v2 preview schema.
/// </summary>
/// <param name="ImagesImported">Number of image entities imported.</param>
/// <param name="GalleriesImported">Number of gallery entities imported.</param>
/// <param name="BooksImported">Number of book entities imported.</param>
/// <param name="AudioLibrariesImported">Number of audio library entities imported.</param>
/// <param name="AudioTracksImported">Number of audio track entities imported.</param>
/// <param name="CollectionsImported">Number of collection entities imported.</param>
/// <param name="LinksImported">Number of relationship or capability links imported.</param>
public sealed record LegacyMediaImportResponse(
    int ImagesImported,
    int GalleriesImported,
    int BooksImported,
    int AudioLibrariesImported,
    int AudioTracksImported,
    int CollectionsImported,
    int LinksImported);

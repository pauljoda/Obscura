namespace Obscura.Application.Migrations;

/// <summary>
/// Import counts returned after moving legacy media data into v2 entity tables.
/// </summary>
/// <param name="ImagesImported">Number of image entities imported.</param>
/// <param name="GalleriesImported">Number of gallery entities imported.</param>
/// <param name="BooksImported">Number of book entities imported.</param>
/// <param name="AudioLibrariesImported">Number of audio-library entities imported.</param>
/// <param name="AudioTracksImported">Number of audio-track entities imported.</param>
/// <param name="CollectionsImported">Number of collection entities imported.</param>
/// <param name="LinksImported">Number of external/provider links imported.</param>
public sealed record LegacyMediaImportResult(
    int ImagesImported,
    int GalleriesImported,
    int BooksImported,
    int AudioLibrariesImported,
    int AudioTracksImported,
    int CollectionsImported,
    int LinksImported);

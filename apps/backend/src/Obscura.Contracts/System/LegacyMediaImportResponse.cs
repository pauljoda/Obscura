namespace Obscura.Contracts.System;

public sealed record LegacyMediaImportResponse(
    int ImagesImported,
    int GalleriesImported,
    int BooksImported,
    int AudioLibrariesImported,
    int AudioTracksImported,
    int CollectionsImported,
    int LinksImported);

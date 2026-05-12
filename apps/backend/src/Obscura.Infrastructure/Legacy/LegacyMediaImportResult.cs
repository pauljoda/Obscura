namespace Obscura.Infrastructure.Legacy;

public sealed record LegacyMediaImportResult(
    int ImagesImported,
    int GalleriesImported,
    int BooksImported,
    int AudioLibrariesImported,
    int AudioTracksImported,
    int CollectionsImported,
    int LinksImported);

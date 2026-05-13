using Obscura.Domain.Entities;

namespace Obscura.Infrastructure.Legacy;

/// <summary>
/// Provides SQL used to preview-import legacy non-video media tables into the v2 entity model.
/// </summary>
public static partial class LegacyMediaImportSql
{
    /// <summary>
    /// Composed PostgreSQL block that imports collections, galleries, images, books, and audio entities.
    /// </summary>
    public static string Import => string.Concat(
        ImportHeader,
        CollectionsImport,
        GalleriesImport,
        ImagesImport,
        BooksImport,
        BookReadProgressImport,
        AudioLibrariesImport,
        AudioTracksImport,
        ExternalIdsImport,
        CollectionItemsImport,
        AudioTrackMarkersImport,
        GalleryTagsImport,
        ImageTagsImport,
        BookTagsImport,
        AudioLibraryTagsImport,
        AudioTrackTagsImport,
        GalleryPerformersImport,
        ImagePerformersImport,
        BookPerformersImport,
        AudioLibraryPerformersImport,
        AudioTrackPerformersImport,
        ImportFooter);

    private const string ImportHeader = """
        DO $$
        BEGIN
""";

    private const string ImportFooter = """
        END $$;
        """;

    /// <summary>
    /// SQL query that reports preview-import counts for migrated non-video media entities and links.
    /// </summary>
    public static readonly string Counts = $$"""
        SELECT
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = '{{EntityKindRegistry.Image.Code}}') AS images_imported,
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = '{{EntityKindRegistry.Gallery.Code}}') AS galleries_imported,
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = '{{EntityKindRegistry.Book.Code}}') AS books_imported,
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = '{{EntityKindRegistry.AudioLibrary.Code}}') AS audio_libraries_imported,
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = '{{EntityKindRegistry.AudioTrack.Code}}') AS audio_tracks_imported,
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = '{{EntityKindRegistry.Collection.Code}}') AS collections_imported,
            ((SELECT COUNT(*)::int FROM v2.entity_hierarchy_links WHERE relationship IN ('{{EntityRelationshipRegistry.Gallery.Code}}', '{{EntityRelationshipRegistry.AudioLibrary.Code}}')) +
             (SELECT COUNT(*)::int FROM v2.entity_hierarchy_links WHERE relationship = '{{EntityRelationshipRegistry.CollectionItem.Code}}') +
             (SELECT COUNT(*)::int FROM v2.entity_credit_links) +
             (SELECT COUNT(*)::int FROM v2.entity_studio_links) +
             (SELECT COUNT(*)::int FROM v2.entity_markers)) AS links_imported;
        """;
}

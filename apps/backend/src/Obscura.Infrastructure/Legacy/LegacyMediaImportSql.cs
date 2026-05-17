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
        NormalizeEntityChildLinks,
        ImportFooter);

    private const string ImportHeader = """
        DO $$
        BEGIN
""";

    private const string ImportFooter = """
        END $$;
        """;

    private static readonly string NormalizeEntityChildLinks = $$"""
            UPDATE v2.entities child
            SET
                parent_entity_id = link.parent_entity_id,
                sort_order = link.sort_order,
                updated_at = GREATEST(child.updated_at, link.created_at)
            FROM v2.entity_child_links link
            WHERE link.child_entity_id = child.id
              AND link.is_structural = true;
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
            ((SELECT COUNT(*)::int FROM v2.entity_child_links WHERE child_kind_code IN ('{{EntityKindRegistry.Gallery.Code}}', '{{EntityKindRegistry.Image.Code}}', '{{EntityKindRegistry.AudioLibrary.Code}}', '{{EntityKindRegistry.AudioTrack.Code}}')) +
             (SELECT COUNT(*)::int FROM v2.entity_child_links WHERE is_structural = false) +
             (SELECT COUNT(*)::int FROM v2.entity_relationship_links) +
             (SELECT COUNT(*)::int FROM v2.entity_markers)) AS links_imported;
        """;
}

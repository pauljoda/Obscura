using Obscura.Infrastructure.Legacy;

namespace Obscura.Infrastructure.Tests;

public sealed class LegacyMediaImportSqlTests
{
    [Fact]
    public void ImportSqlReadsLegacyMediaSourcesAndWritesV2Entities()
    {
        Assert.Contains("public.images", LegacyMediaImportSql.Import);
        Assert.Contains("public.galleries", LegacyMediaImportSql.Import);
        Assert.Contains("public.books", LegacyMediaImportSql.Import);
        Assert.Contains("public.audio_libraries", LegacyMediaImportSql.Import);
        Assert.Contains("public.audio_tracks", LegacyMediaImportSql.Import);
        Assert.Contains("public.collections", LegacyMediaImportSql.Import);
        Assert.Contains("public.collection_items", LegacyMediaImportSql.Import);
        Assert.Contains("v2.entity_hierarchy_links", LegacyMediaImportSql.Import);
        Assert.Contains("v2.entity_credit_links", LegacyMediaImportSql.Import);
        Assert.Contains("v2.entity_studio_links", LegacyMediaImportSql.Import);
        Assert.Contains("v2.entity_external_ids", LegacyMediaImportSql.Import);
        Assert.Contains("v2.entity_urls", LegacyMediaImportSql.Import);
        Assert.Contains("v2.entity_markers", LegacyMediaImportSql.Import);
        Assert.Contains("v2.entity_descriptions", LegacyMediaImportSql.Import);
        Assert.Contains("v2.entity_file_fingerprints", LegacyMediaImportSql.Import);
        Assert.Contains("v2.entity_dates", LegacyMediaImportSql.Import);
        Assert.Contains("v2.entity_technical", LegacyMediaImportSql.Import);
        Assert.Contains("v2.entity_sources", LegacyMediaImportSql.Import);
        Assert.Contains("v2.entity_stats", LegacyMediaImportSql.Import);
        Assert.Contains("v2.entity_progress", LegacyMediaImportSql.Import);
        Assert.Contains("v2.entity_positions", LegacyMediaImportSql.Import);
        Assert.Contains("v2.entity_playback", LegacyMediaImportSql.Import);
        Assert.Contains("v2.gallery_details", LegacyMediaImportSql.Import);
        Assert.Contains("v2.image_details", LegacyMediaImportSql.Import);
        Assert.Contains("v2.book_details", LegacyMediaImportSql.Import);
        Assert.DoesNotContain("v2.book_read_progress", LegacyMediaImportSql.Import);
        Assert.Contains("v2.audio_library_details", LegacyMediaImportSql.Import);
        Assert.Contains("v2.audio_track_details", LegacyMediaImportSql.Import);
    }

    [Fact]
    public void ImportSqlDoesNotMutateLegacyTables()
    {
        Assert.DoesNotContain("UPDATE public.", LegacyMediaImportSql.Import, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("DELETE FROM public.", LegacyMediaImportSql.Import, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("TRUNCATE public.", LegacyMediaImportSql.Import, StringComparison.OrdinalIgnoreCase);
    }
}

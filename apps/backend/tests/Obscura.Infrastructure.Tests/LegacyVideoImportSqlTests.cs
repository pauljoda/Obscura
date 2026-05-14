using Obscura.Infrastructure.Legacy;

namespace Obscura.Infrastructure.Tests;

public sealed class LegacyVideoImportSqlTests
{
    [Fact]
    public void ImportSqlReadsLegacyVideoSourcesAndWritesV2Entities()
    {
        Assert.Contains("public.video_series", LegacyVideoImportSql.Import);
        Assert.Contains("public.video_movies", LegacyVideoImportSql.Import);
        Assert.Contains("public.video_episodes", LegacyVideoImportSql.Import);
        Assert.Contains("public.performers", LegacyVideoImportSql.Import);
        Assert.Contains("v2.entities", LegacyVideoImportSql.Import);
        Assert.Contains("v2.entity_hierarchy_links", LegacyVideoImportSql.Import);
        Assert.Contains("v2.entity_credit_links", LegacyVideoImportSql.Import);
        Assert.Contains("v2.entity_studio_links", LegacyVideoImportSql.Import);
        Assert.Contains("v2.entity_external_ids", LegacyVideoImportSql.Import);
        Assert.Contains("v2.entity_urls", LegacyVideoImportSql.Import);
        Assert.Contains("v2.entity_descriptions", LegacyVideoImportSql.Import);
        Assert.Contains("v2.entity_playback", LegacyVideoImportSql.Import);
        Assert.Contains("v2.entity_file_fingerprints", LegacyVideoImportSql.Import);
        Assert.Contains("v2.entity_dates", LegacyVideoImportSql.Import);
        Assert.Contains("v2.entity_technical", LegacyVideoImportSql.Import);
        Assert.Contains("v2.entity_sources", LegacyVideoImportSql.Import);
        Assert.Contains("v2.entity_positions", LegacyVideoImportSql.Import);
        Assert.Contains("v2.entity_classifications", LegacyVideoImportSql.Import);
        Assert.Contains("v2.entity_markers", LegacyVideoImportSql.Import);
        Assert.Contains("v2.entity_subtitles", LegacyVideoImportSql.Import);
        Assert.Contains("v2.entity_counters", LegacyVideoImportSql.Import);
        Assert.Contains("orgasm_count", LegacyVideoImportSql.Import);
        Assert.Contains("checksum_md5", LegacyVideoImportSql.Import);
        Assert.Contains("oshash", LegacyVideoImportSql.Import);
        Assert.Contains("phash", LegacyVideoImportSql.Import);
    }

    [Fact]
    public void ImportSqlDoesNotMutateLegacyTables()
    {
        Assert.DoesNotContain("UPDATE public.", LegacyVideoImportSql.Import, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("DELETE FROM public.", LegacyVideoImportSql.Import, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("TRUNCATE public.", LegacyVideoImportSql.Import, StringComparison.OrdinalIgnoreCase);
    }
}

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
        Assert.Contains("v2.entity_child_links", LegacyVideoImportSql.Import);
        Assert.DoesNotContain("v2.entity_hierarchy_links", LegacyVideoImportSql.Import);
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
        Assert.Contains("v2.video_season_details", LegacyVideoImportSql.Import);
        Assert.Contains("'season'", LegacyVideoImportSql.Import);
        Assert.Contains("season_folder_path", LegacyVideoImportSql.Import);
        Assert.Contains("orgasm_count", LegacyVideoImportSql.Import);
        Assert.Contains("checksum_md5", LegacyVideoImportSql.Import);
        Assert.Contains("oshash", LegacyVideoImportSql.Import);
        Assert.Contains("phash", LegacyVideoImportSql.Import);
    }

    [Fact]
    public void ImportSqlPreservesLegacySeriesArtwork()
    {
        Assert.Contains("series.poster_path", LegacyVideoImportSql.Import);
        Assert.Contains("series.backdrop_path", LegacyVideoImportSql.Import);
        Assert.Contains("series.logo_path", LegacyVideoImportSql.Import);
        Assert.Contains("'poster'", LegacyVideoImportSql.Import);
        Assert.Contains("'backdrop'", LegacyVideoImportSql.Import);
        Assert.Contains("'logo'", LegacyVideoImportSql.Import);
    }

    [Fact]
    public void ImportSqlPreservesLegacySeasonMetadata()
    {
        Assert.Contains("public.video_seasons", LegacyVideoImportSql.Import);
        Assert.Contains("season.poster_path", LegacyVideoImportSql.Import);
        Assert.Contains("season.overview", LegacyVideoImportSql.Import);
        Assert.Contains("season.air_date", LegacyVideoImportSql.Import);
        Assert.Contains("season.external_ids", LegacyVideoImportSql.Import);
        Assert.Contains("jsonb_each_text(COALESCE(legacy.external_ids", LegacyVideoImportSql.Import);
    }

    [Fact]
    public void ImportSqlDoesNotMutateLegacyTables()
    {
        Assert.DoesNotContain("UPDATE public.", LegacyVideoImportSql.Import, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("DELETE FROM public.", LegacyVideoImportSql.Import, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("TRUNCATE public.", LegacyVideoImportSql.Import, StringComparison.OrdinalIgnoreCase);
    }
}

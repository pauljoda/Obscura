using Obscura.Infrastructure.FreshStart;

namespace Obscura.Infrastructure.Tests;

public sealed class FreshStartSqlTests
{
    [Fact]
    public void PreserveConfigurationSqlCopiesOnlyLibrarySettingsAndRootsFromPublicSchema()
    {
        var sql = FreshStartSql.PreserveConfiguration;

        Assert.Contains("INSERT INTO v2.library_settings", sql);
        Assert.Contains("FROM public.library_settings", sql);
        Assert.Contains("INSERT INTO v2.library_roots", sql);
        Assert.Contains("FROM public.library_roots", sql);
        Assert.Contains("v2.entity_stats", sql);
        Assert.Contains("v2.entity_child_links", sql);
        Assert.Contains("v2.entity_dates", sql);
        Assert.Contains("v2.entity_technical", sql);
        Assert.Contains("v2.entity_sources", sql);
        Assert.Contains("v2.entity_progress", sql);
        Assert.Contains("v2.entity_positions", sql);
        Assert.Contains("v2.entity_classifications", sql);
        Assert.DoesNotContain("public.videos", sql);
        Assert.DoesNotContain("public.images", sql);
        Assert.DoesNotContain("public.galleries", sql);
        Assert.DoesNotContain("public.books", sql);
    }

    [Fact]
    public void PurgeNonSourceEntityFilesSqlKeepsCustomLegacyArtwork()
    {
        var sql = FreshStartSql.PurgeNonSourceEntityFiles;

        Assert.Contains("role <> 'source'", sql);
        Assert.Contains("source <> 'custom'", sql);
    }
}

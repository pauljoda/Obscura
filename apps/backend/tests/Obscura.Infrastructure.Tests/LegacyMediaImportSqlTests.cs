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
        Assert.Contains("v2.entity_hierarchy_links", LegacyMediaImportSql.Import);
        Assert.Contains("v2.entity_credit_links", LegacyMediaImportSql.Import);
        Assert.Contains("v2.entity_studio_links", LegacyMediaImportSql.Import);
    }

    [Fact]
    public void ImportSqlDoesNotMutateLegacyTables()
    {
        Assert.DoesNotContain("UPDATE public.", LegacyMediaImportSql.Import, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("DELETE FROM public.", LegacyMediaImportSql.Import, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("TRUNCATE public.", LegacyMediaImportSql.Import, StringComparison.OrdinalIgnoreCase);
    }
}

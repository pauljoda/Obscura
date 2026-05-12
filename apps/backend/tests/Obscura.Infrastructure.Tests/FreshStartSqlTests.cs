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
        Assert.DoesNotContain("public.videos", sql);
        Assert.DoesNotContain("public.images", sql);
        Assert.DoesNotContain("public.galleries", sql);
        Assert.DoesNotContain("public.books", sql);
    }
}

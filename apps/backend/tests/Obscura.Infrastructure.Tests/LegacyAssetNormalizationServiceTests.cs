using Obscura.Infrastructure.FreshStart;
using Obscura.Infrastructure.Legacy;

namespace Obscura.Infrastructure.Tests;

public sealed class LegacyAssetNormalizationServiceTests
{
    [Fact]
    public void FreshStartPurgesGeneratedCacheButKeepsLegacyArtworkFolders()
    {
        Assert.True(V2FreshStartService.ShouldPurgeCacheSubdirectory("/data/cache/videos"));
        Assert.True(V2FreshStartService.ShouldPurgeCacheSubdirectory("/data/cache/hlsv"));
        Assert.False(V2FreshStartService.ShouldPurgeCacheSubdirectory("/data/cache/video-series"));
        Assert.False(V2FreshStartService.ShouldPurgeCacheSubdirectory("/data/cache/seasons"));
    }

    [Fact]
    public void SeriesArtworkCandidatesMapKodiNamesToV2Roles()
    {
        var root = Path.Combine(Path.GetTempPath(), "The Chair Company");

        var backdropCandidates = LegacyAssetNormalizationService.LegacyArtworkCandidates("video-series", "backdrop", root, null);
        Assert.Equal(Path.Combine(root, "banner.jpg"), backdropCandidates[0]);
        Assert.Contains(
            Path.Combine(root, "poster.jpg"),
            LegacyAssetNormalizationService.LegacyArtworkCandidates("video-series", "poster", root, null));
        Assert.Contains(
            Path.Combine(root, "clearlogo.png"),
            LegacyAssetNormalizationService.LegacyArtworkCandidates("video-series", "logo", root, null));
    }

    [Fact]
    public void SeasonArtworkCandidatesPreferParentSeasonPoster()
    {
        var season = Path.Combine(Path.GetTempPath(), "The Chair Company", "Season 1");
        var parent = Path.GetDirectoryName(season)!;

        var candidates = LegacyAssetNormalizationService.LegacyArtworkCandidates("video-season", "poster", season, 1);

        Assert.Equal(Path.Combine(parent, "season01-poster.jpg"), candidates[0]);
        Assert.Contains(Path.Combine(season, "poster.jpg"), candidates);
    }
}

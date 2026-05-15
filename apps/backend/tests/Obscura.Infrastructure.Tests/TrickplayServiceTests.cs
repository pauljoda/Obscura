using Obscura.Infrastructure.Videos;

namespace Obscura.Infrastructure.Tests;

public sealed class TrickplayServiceTests : IDisposable
{
    private readonly string _cacheRoot = Path.Combine(Path.GetTempPath(), $"obscura-trickplay-{Guid.NewGuid():N}");

    public TrickplayServiceTests()
    {
        Directory.CreateDirectory(_cacheRoot);
    }

    [Fact]
    public async Task BuildsImagesOnlyPlaylistFromJpegTiles()
    {
        var itemId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var tileRoot = Path.Combine(_cacheRoot, "trickplay", itemId.ToString(), "320");
        Directory.CreateDirectory(tileRoot);
        await File.WriteAllTextAsync(Path.Combine(tileRoot, "0.jpg"), "tile0");
        await File.WriteAllTextAsync(Path.Combine(tileRoot, "1.jpg"), "tile1");
        var service = new TrickplayService(new HlsAssetServiceOptions(_cacheRoot));

        var playlist = await service.GetPlaylistAsync(itemId, 320, CancellationToken.None);

        Assert.NotNull(playlist);
        Assert.Contains("#EXT-X-IMAGES-ONLY", playlist.Content);
        Assert.Contains("#EXT-X-TILES:RESOLUTION=320x180,LAYOUT=5x5,DURATION=10", playlist.Content);
        Assert.Contains("0.jpg", playlist.Content);
        Assert.Contains("1.jpg", playlist.Content);
    }

    [Fact]
    public async Task ResolvesTileInsideExpectedWidthFolder()
    {
        var itemId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var tileRoot = Path.Combine(_cacheRoot, "trickplay", itemId.ToString(), "320");
        Directory.CreateDirectory(tileRoot);
        var tilePath = Path.Combine(tileRoot, "0.jpg");
        await File.WriteAllTextAsync(tilePath, "tile0");
        var service = new TrickplayService(new HlsAssetServiceOptions(_cacheRoot));

        var tile = await service.GetTileAsync(itemId, 320, 0, CancellationToken.None);

        Assert.NotNull(tile);
        Assert.Equal(tilePath, tile.Path);
        Assert.Equal("image/jpeg", tile.ContentType);
        Assert.Equal("public, max-age=31536000, immutable", tile.CacheControl);
    }

    public void Dispose()
    {
        if (Directory.Exists(_cacheRoot))
        {
            Directory.Delete(_cacheRoot, recursive: true);
        }
    }
}

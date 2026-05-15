using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Obscura.Application.Videos;

namespace Obscura.Api.Tests;

public sealed class VideoHlsEndpointTests : IDisposable
{
    private readonly string _tempDir = Path.Combine(Path.GetTempPath(), $"obscura-api-hls-{Guid.NewGuid():N}");

    public VideoHlsEndpointTests()
    {
        Directory.CreateDirectory(_tempDir);
    }

    [Fact]
    public async Task HlsManifestEndpointServesMpegUrlAsset()
    {
        var filePath = Path.Combine(_tempDir, "master.m3u8");
        await File.WriteAllTextAsync(filePath, "#EXTM3U");
        using var factory = CreateFactory(new FakeHlsAssetService(
            new HlsAsset(filePath, "application/vnd.apple.mpegurl", "public, max-age=60")));
        using var client = factory.CreateClient();

        using var response = await client.GetAsync($"/api/videos/{FakeHlsAssetService.VideoId}/hls/master.m3u8");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/vnd.apple.mpegurl", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("public, max-age=60", response.Headers.CacheControl?.ToString());
        Assert.Equal("#EXTM3U", body);
    }

    [Fact]
    public async Task HlsAssetEndpointReturnsProblemDetailsWhenMissing()
    {
        using var factory = CreateFactory(new FakeHlsAssetService(null));
        using var client = factory.CreateClient();

        using var response = await client.GetAsync($"/api/videos/{FakeHlsAssetService.VideoId}/hls/v/720p/seg_00000.ts");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task SubtitleEndpointServesStoredSubtitleAsset()
    {
        var trackId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var filePath = Path.Combine(_tempDir, "track.vtt");
        await File.WriteAllTextAsync(filePath, "WEBVTT");
        using var factory = CreateFactory(
            new FakeHlsAssetService(null),
            new FakeVideoSubtitleAssetService(new VideoSubtitleAsset(filePath, "text/vtt; charset=utf-8")));
        using var client = factory.CreateClient();

        using var response = await client.GetAsync($"/api/videos/{FakeHlsAssetService.VideoId}/subtitles/{trackId}");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/vtt", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("WEBVTT", body);
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempDir))
        {
            Directory.Delete(_tempDir, recursive: true);
        }
    }

    private static WebApplicationFactory<Program> CreateFactory(IHlsAssetService hlsAssets)
    {
        return CreateFactory(hlsAssets, new FakeVideoSubtitleAssetService(null));
    }

    private static WebApplicationFactory<Program> CreateFactory(
        IHlsAssetService hlsAssets,
        IVideoSubtitleAssetService subtitleAssets)
    {
        return new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    services.AddSingleton(hlsAssets);
                    services.AddSingleton(subtitleAssets);
                });
            });
    }

    private sealed class FakeHlsAssetService : IHlsAssetService
    {
        public static readonly Guid VideoId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        private readonly HlsAsset? _asset;

        public FakeHlsAssetService(HlsAsset? asset)
        {
            _asset = asset;
        }

        public Task<HlsAsset?> GetAssetAsync(
            Guid id,
            string assetPath,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(id == VideoId ? _asset : null);
        }
    }

    private sealed class FakeVideoSubtitleAssetService : IVideoSubtitleAssetService
    {
        private readonly VideoSubtitleAsset? _asset;

        public FakeVideoSubtitleAssetService(VideoSubtitleAsset? asset)
        {
            _asset = asset;
        }

        public Task<VideoSubtitleAsset?> GetSubtitleAsync(
            Guid videoId,
            Guid trackId,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(videoId == FakeHlsAssetService.VideoId ? _asset : null);
        }

        public Task<VideoSubtitleAsset?> GetSubtitleSourceAsync(
            Guid videoId,
            Guid trackId,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(videoId == FakeHlsAssetService.VideoId ? _asset : null);
        }
    }
}

using Microsoft.Extensions.Logging.Abstractions;
using Obscura.Application.Videos;
using Obscura.Infrastructure.Processes;
using Obscura.Infrastructure.Videos;

namespace Obscura.Infrastructure.Tests;

public sealed class HlsAssetServiceTests : IDisposable
{
    private readonly string _cacheRoot = Path.Combine(Path.GetTempPath(), $"obscura-hls-assets-{Guid.NewGuid():N}");

    public HlsAssetServiceTests()
    {
        Directory.CreateDirectory(_cacheRoot);
    }

    [Fact]
    public async Task ResolvesHls2ManifestAndSegmentAssets()
    {
        var videoId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var packageDir = Path.Combine(_cacheRoot, "hls2", videoId.ToString(), "v", "720p");
        Directory.CreateDirectory(packageDir);
        var manifestPath = Path.Combine(_cacheRoot, "hls2", videoId.ToString(), "master.m3u8");
        var segmentPath = Path.Combine(packageDir, "seg_00000.ts");
        await File.WriteAllTextAsync(manifestPath, "#EXTM3U");
        await File.WriteAllTextAsync(segmentPath, "segment");

        var service = new HlsAssetService(new HlsAssetServiceOptions(_cacheRoot));
        var manifest = await service.GetAssetAsync(videoId, "master.m3u8", CancellationToken.None);
        var segment = await service.GetAssetAsync(videoId, "v/720p/seg_00000.ts", CancellationToken.None);

        Assert.NotNull(manifest);
        Assert.Equal("application/vnd.apple.mpegurl", manifest.ContentType);
        Assert.Equal("public, max-age=60", manifest.CacheControl);
        Assert.NotNull(segment);
        Assert.Equal("video/mp2t", segment.ContentType);
        Assert.Equal("public, max-age=31536000, immutable", segment.CacheControl);
    }

    [Fact]
    public async Task RejectsTraversalOutsidePackageRoot()
    {
        var videoId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var service = new HlsAssetService(new HlsAssetServiceOptions(_cacheRoot));

        var asset = await service.GetAssetAsync(videoId, "../secret.ts", CancellationToken.None);

        Assert.Null(asset);
    }

    [Fact]
    public async Task StartsGenerationWhenMasterManifestIsMissing()
    {
        var videoId = Guid.Parse("33333333-3333-3333-3333-333333333333");
        var sourcePath = Path.Combine(_cacheRoot, "source.mkv");
        await File.WriteAllTextAsync(sourcePath, "source");
        var process = new ManifestWritingProcessExecutor();
        var service = new HlsAssetService(
            new HlsAssetServiceOptions(_cacheRoot),
            new FakeVideoSourceService(new VideoSourceFile(videoId, sourcePath, "video/x-matroska", false)),
            process,
            NullLogger<HlsAssetService>.Instance);

        var asset = await service.GetAssetAsync(videoId, "master.m3u8", CancellationToken.None);

        Assert.NotNull(asset);
        Assert.Equal("application/vnd.apple.mpegurl", asset.ContentType);
        Assert.True(process.WasCalled);
    }

    public void Dispose()
    {
        if (Directory.Exists(_cacheRoot))
        {
            Directory.Delete(_cacheRoot, recursive: true);
        }
    }

    private sealed class FakeVideoSourceService : IVideoSourceService
    {
        private readonly VideoSourceFile _source;

        public FakeVideoSourceService(VideoSourceFile source)
        {
            _source = source;
        }

        public Task<VideoSourceFile?> GetSourceAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult(id == _source.EntityId ? _source : null);
        }
    }

    private sealed class ManifestWritingProcessExecutor : ProcessExecutor
    {
        public bool WasCalled { get; private set; }

        public override async Task<ProcessExecutionResult> RunAsync(
            string fileName,
            IReadOnlyList<string> arguments,
            IReadOnlyDictionary<string, string>? environment,
            CancellationToken cancellationToken)
        {
            WasCalled = true;
            var manifestPath = arguments[^1];
            Directory.CreateDirectory(Path.GetDirectoryName(manifestPath)!);
            await File.WriteAllTextAsync(manifestPath, "#EXTM3U", cancellationToken);
            return new ProcessExecutionResult(0, string.Empty, string.Empty);
        }
    }
}

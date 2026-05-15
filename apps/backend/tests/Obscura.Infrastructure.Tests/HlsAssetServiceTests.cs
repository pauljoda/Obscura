using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.EntityFrameworkCore;
using Obscura.Application.Videos;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;
using Obscura.Infrastructure.Processes;
using Obscura.Infrastructure.Videos;

namespace Obscura.Infrastructure.Tests;

public sealed class HlsAssetServiceTests : IDisposable
{
    private const string SegmentLengthText = "6";
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
    public async Task VirtualManifestIsVodAndCoversFullDuration()
    {
        var videoId = Guid.Parse("33333333-3333-3333-3333-333333333333");
        var sourcePath = Path.Combine(_cacheRoot, "source.mkv");
        await File.WriteAllTextAsync(sourcePath, "source");
        var process = new ManifestWritingProcessExecutor();
        var service = new HlsAssetService(
            new HlsAssetServiceOptions(_cacheRoot),
            new FakeVideoSourceService(new VideoSourceFile(
                videoId,
                sourcePath,
                "video/x-matroska",
                false,
                DurationSeconds: 13,
                Width: 1920,
                Height: 960)),
            process,
            NullLogger<HlsAssetService>.Instance);

        var master = await service.GetAssetAsync(videoId, "master.m3u8", CancellationToken.None);
        var variant = await service.GetAssetAsync(videoId, "v/720p/index.m3u8", CancellationToken.None);

        Assert.NotNull(master);
        Assert.Contains("hls/720p/index.m3u8", await File.ReadAllTextAsync(master.Path));
        Assert.NotNull(variant);
        var playlist = await File.ReadAllTextAsync(variant.Path);
        Assert.Contains("#EXT-X-PLAYLIST-TYPE:VOD", playlist);
        Assert.Contains("#EXT-X-TARGETDURATION:6", playlist);
        Assert.Contains("#EXTINF:1.000000,", playlist);
        Assert.Contains("#EXT-X-ENDLIST", playlist);
        Assert.False(process.WasCalled);
    }

    [Fact]
    public async Task VirtualManifestAdvertisesGeneratedTrickplayPlaylist()
    {
        await using var db = CreateContext();
        var videoId = Guid.Parse("55555555-5555-5555-5555-555555555555");
        db.Entities.Add(new EntityRow
        {
            Id = videoId,
            KindCode = EntityKindRegistry.Video.Code,
            Title = "Video",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        db.TrickplayInfos.Add(new TrickplayInfoRow
        {
            EntityId = videoId,
            Width = 280,
            Height = 158,
            TileWidth = 4,
            TileHeight = 4,
            ThumbnailCount = 16,
            IntervalSeconds = 7,
            Bandwidth = 1234,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        var sourcePath = Path.Combine(_cacheRoot, "source.mkv");
        await File.WriteAllTextAsync(sourcePath, "source");
        var service = new HlsAssetService(
            new HlsAssetServiceOptions(_cacheRoot),
            new FakeVideoSourceService(new VideoSourceFile(
                videoId,
                sourcePath,
                "video/x-matroska",
                false,
                DurationSeconds: 13,
                Width: 1920,
                Height: 960)),
            new ManifestWritingProcessExecutor(),
            NullLogger<HlsAssetService>.Instance,
            db);

        var master = await service.GetAssetAsync(videoId, "master.m3u8", CancellationToken.None);

        Assert.NotNull(master);
        var content = await File.ReadAllTextAsync(master.Path);
        Assert.Contains("#EXT-X-IMAGE-STREAM-INF:BANDWIDTH=1234,RESOLUTION=280x158,CODECS=\"jpeg\",URI=\"Trickplay/280/tiles.m3u8\"", content);
    }

    [Fact]
    public async Task ConcurrentVirtualCacheRefreshesDoNotRaceDirectoryDeletion()
    {
        var videoId = Guid.Parse("66666666-6666-6666-6666-666666666666");
        var sourcePath = Path.Combine(_cacheRoot, "source.mkv");
        await File.WriteAllTextAsync(sourcePath, "source");
        var virtualRoot = Path.Combine(_cacheRoot, "hlsv", videoId.ToString());
        Directory.CreateDirectory(Path.Combine(virtualRoot, "v", "720p"));
        await File.WriteAllTextAsync(
            Path.Combine(virtualRoot, "metadata.json"),
            """
            {
              "SourcePath": "/stale/source.mkv",
              "SourceSize": 1,
              "SourceModifiedUtc": "2001-01-01T00:00:00Z",
              "DurationSeconds": 1,
              "Renditions": ["720p"]
            }
            """);
        await File.WriteAllTextAsync(Path.Combine(virtualRoot, "v", "720p", "seg_00000.ts"), "stale");
        var source = new VideoSourceFile(
            videoId,
            sourcePath,
            "video/x-matroska",
            false,
            DurationSeconds: 13,
            Width: 1920,
            Height: 960);
        var service = new HlsAssetService(
            new HlsAssetServiceOptions(_cacheRoot),
            new CoordinatedVideoSourceService(source, expectedCalls: 12),
            new ManifestWritingProcessExecutor(),
            NullLogger<HlsAssetService>.Instance);

        var requests = Enumerable.Range(0, 12)
            .Select(index => service.GetAssetAsync(
                videoId,
                index % 2 == 0 ? "master.m3u8" : "v/720p/index.m3u8",
                CancellationToken.None))
            .ToArray();
        var assets = await Task.WhenAll(requests);

        Assert.All(assets, Assert.NotNull);
        Assert.True(File.Exists(Path.Combine(virtualRoot, "metadata.json")));
    }

    [Fact]
    public async Task VirtualCacheWithoutFormatVersionIsRefreshed()
    {
        var videoId = Guid.Parse("88888888-8888-8888-8888-888888888888");
        var sourcePath = Path.Combine(_cacheRoot, "source.mkv");
        await File.WriteAllTextAsync(sourcePath, "source");
        var sourceInfo = new FileInfo(sourcePath);
        var virtualRoot = Path.Combine(_cacheRoot, "hlsv", videoId.ToString());
        Directory.CreateDirectory(Path.Combine(virtualRoot, "v", "720p"));
        await File.WriteAllTextAsync(
            Path.Combine(virtualRoot, "metadata.json"),
            $$"""
            {
              "SourcePath": "{{sourcePath.Replace("\\", "\\\\")}}",
              "SourceSize": {{sourceInfo.Length}},
              "SourceModifiedUtc": "{{sourceInfo.LastWriteTimeUtc:O}}",
              "DurationSeconds": 13,
              "Renditions": ["720p"]
            }
            """);
        await File.WriteAllTextAsync(Path.Combine(virtualRoot, "v", "720p", "seg_00000.ts"), "old");
        var service = new HlsAssetService(
            new HlsAssetServiceOptions(_cacheRoot),
            new FakeVideoSourceService(new VideoSourceFile(
                videoId,
                sourcePath,
                "video/x-matroska",
                false,
                DurationSeconds: 13,
                Width: 1920,
                Height: 960)),
            new ManifestWritingProcessExecutor(),
            NullLogger<HlsAssetService>.Instance);

        var asset = await service.GetAssetAsync(videoId, "master.m3u8", CancellationToken.None);

        Assert.NotNull(asset);
        var metadata = await File.ReadAllTextAsync(Path.Combine(virtualRoot, "metadata.json"));
        Assert.Contains("\"FormatVersion\": 2", metadata);
        Assert.False(File.Exists(Path.Combine(virtualRoot, "v", "720p", "seg_00000.ts")));
    }

    [Fact]
    public async Task VirtualSegmentStartsContinuousRenditionGeneration()
    {
        var videoId = Guid.Parse("44444444-4444-4444-4444-444444444444");
        var sourcePath = Path.Combine(_cacheRoot, "source.mkv");
        await File.WriteAllTextAsync(sourcePath, "source");
        var process = new ManifestWritingProcessExecutor();
        var service = new HlsAssetService(
            new HlsAssetServiceOptions(_cacheRoot),
            new FakeVideoSourceService(new VideoSourceFile(
                videoId,
                sourcePath,
                "video/x-matroska",
                false,
                DurationSeconds: 13,
                Width: 1920,
                Height: 960)),
            process,
            NullLogger<HlsAssetService>.Instance);

        var segment = await service.GetAssetAsync(videoId, "v/720p/seg_00000.ts", CancellationToken.None);

        Assert.NotNull(segment);
        Assert.Equal("video/mp2t", segment.ContentType);
        Assert.True(process.WasCalled);
        Assert.Contains(process.ArgumentHistory, arguments =>
            arguments.Contains("-hls_segment_filename"));
    }

    [Fact]
    public async Task VirtualSegmentsAreGeneratedByOneContinuousHlsMuxer()
    {
        var videoId = Guid.Parse("77777777-7777-7777-7777-777777777777");
        var sourcePath = Path.Combine(_cacheRoot, "source.mkv");
        await File.WriteAllTextAsync(sourcePath, "source");
        var process = new ManifestWritingProcessExecutor();
        var service = new HlsAssetService(
            new HlsAssetServiceOptions(_cacheRoot),
            new FakeVideoSourceService(new VideoSourceFile(
                videoId,
                sourcePath,
                "video/x-matroska",
                false,
                DurationSeconds: 13,
                Width: 1920,
                Height: 960)),
            process,
            NullLogger<HlsAssetService>.Instance);

        var segment = await service.GetAssetAsync(videoId, "v/720p/seg_00001.ts", CancellationToken.None);

        Assert.NotNull(segment);
        var arguments = Assert.Single(process.ArgumentHistory);
        Assert.Contains("-f", arguments);
        Assert.Contains("hls", arguments);
        Assert.Contains("-hls_time", arguments);
        Assert.Contains(SegmentLengthText, arguments);
        Assert.Contains("-hls_segment_filename", arguments);
        Assert.Contains("-hls_flags", arguments);
        Assert.Contains("temp_file", arguments);
        Assert.Contains("-start_number", arguments);
        Assert.Contains("1", arguments);
        Assert.Contains("-copyts", arguments);
        Assert.Contains("-avoid_negative_ts", arguments);
        Assert.Contains("disabled", arguments);
        Assert.DoesNotContain("-output_ts_offset", arguments);
    }

    [Fact]
    public async Task FarVirtualSegmentStartsGenerationAtRequestedSegment()
    {
        var videoId = Guid.Parse("99999999-9999-9999-9999-999999999999");
        var sourcePath = Path.Combine(_cacheRoot, "source.mkv");
        await File.WriteAllTextAsync(sourcePath, "source");
        var process = new ManifestWritingProcessExecutor();
        var service = new HlsAssetService(
            new HlsAssetServiceOptions(_cacheRoot),
            new FakeVideoSourceService(new VideoSourceFile(
                videoId,
                sourcePath,
                "video/x-matroska",
                false,
                DurationSeconds: 180,
                Width: 1920,
                Height: 960)),
            process,
            NullLogger<HlsAssetService>.Instance);

        var segment = await service.GetAssetAsync(videoId, "v/720p/seg_00020.ts", CancellationToken.None);

        Assert.NotNull(segment);
        var arguments = Assert.Single(process.ArgumentHistory);
        Assert.Contains("-ss", arguments);
        Assert.Contains("120.000", arguments);
        Assert.Contains("-start_number", arguments);
        Assert.Contains("20", arguments);
        Assert.DoesNotContain("-t", arguments);
    }

    [Fact]
    public async Task MissingVirtualSegmentReturnsNullAsset()
    {
        var videoId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var sourcePath = Path.Combine(_cacheRoot, "source.mkv");
        await File.WriteAllTextAsync(sourcePath, "source");
        var service = new HlsAssetService(
            new HlsAssetServiceOptions(_cacheRoot),
            new FakeVideoSourceService(new VideoSourceFile(
                videoId,
                sourcePath,
                "video/x-matroska",
                false,
                DurationSeconds: 180,
                Width: 1920,
                Height: 960)),
            new MissingSegmentProcessExecutor(),
            NullLogger<HlsAssetService>.Instance);

        var segment = await service.GetAssetAsync(videoId, "v/720p/seg_00020.ts", CancellationToken.None);

        Assert.Null(segment);
    }

    public void Dispose()
    {
        if (Directory.Exists(_cacheRoot))
        {
            Directory.Delete(_cacheRoot, recursive: true);
        }
    }

    private static ObscuraDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ObscuraDbContext>()
            .UseInMemoryDatabase($"hls-assets-{Guid.NewGuid():N}")
            .Options;

        return new ObscuraDbContext(options);
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

    private sealed class CoordinatedVideoSourceService : IVideoSourceService
    {
        private readonly VideoSourceFile _source;
        private readonly int _expectedCalls;
        private readonly TaskCompletionSource _allArrived = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int _calls;

        public CoordinatedVideoSourceService(VideoSourceFile source, int expectedCalls)
        {
            _source = source;
            _expectedCalls = expectedCalls;
        }

        public async Task<VideoSourceFile?> GetSourceAsync(Guid id, CancellationToken cancellationToken)
        {
            if (Interlocked.Increment(ref _calls) >= _expectedCalls)
            {
                _allArrived.TrySetResult();
            }

            await _allArrived.Task.WaitAsync(TimeSpan.FromSeconds(5), cancellationToken);
            return id == _source.EntityId ? _source : null;
        }
    }

    private sealed class ManifestWritingProcessExecutor : ProcessExecutor
    {
        public bool WasCalled { get; private set; }
        public IReadOnlyList<string> LastArguments { get; private set; } = [];
        public List<IReadOnlyList<string>> ArgumentHistory { get; } = [];

        public override async Task<ProcessExecutionResult> RunAsync(
            string fileName,
            IReadOnlyList<string> arguments,
            IReadOnlyDictionary<string, string>? environment,
            CancellationToken cancellationToken)
        {
            WasCalled = true;
            LastArguments = arguments;
            ArgumentHistory.Add(arguments);
            var outputPath = arguments[^1];
            Directory.CreateDirectory(Path.GetDirectoryName(outputPath)!);
            var segmentPatternIndex = arguments.ToList().IndexOf("-hls_segment_filename");
            if (segmentPatternIndex >= 0 &&
                segmentPatternIndex < arguments.Count - 1)
            {
                var segmentPattern = arguments[segmentPatternIndex + 1];
                var startNumberIndex = arguments.ToList().IndexOf("-start_number");
                var startNumber = startNumberIndex >= 0 &&
                    startNumberIndex < arguments.Count - 1 &&
                    int.TryParse(arguments[startNumberIndex + 1], out var parsedStart)
                        ? parsedStart
                        : 0;
                for (var index = startNumber; index < startNumber + 5; index++)
                {
                    await File.WriteAllTextAsync(
                        segmentPattern.Replace("%05d", index.ToString("00000")),
                        "segment",
                        cancellationToken);
                }
            }

            await File.WriteAllTextAsync(outputPath, "segment", cancellationToken);
            return new ProcessExecutionResult(0, string.Empty, string.Empty);
        }
    }

    private sealed class MissingSegmentProcessExecutor : ProcessExecutor
    {
        public override async Task<ProcessExecutionResult> RunAsync(
            string fileName,
            IReadOnlyList<string> arguments,
            IReadOnlyDictionary<string, string>? environment,
            CancellationToken cancellationToken)
        {
            var outputPath = arguments[^1];
            Directory.CreateDirectory(Path.GetDirectoryName(outputPath)!);
            await File.WriteAllTextAsync(outputPath, "playlist", cancellationToken);
            return new ProcessExecutionResult(0, string.Empty, string.Empty);
        }
    }
}

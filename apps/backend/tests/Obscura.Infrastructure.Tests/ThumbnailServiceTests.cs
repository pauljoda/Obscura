using Obscura.Infrastructure.Media.Processing;
using Obscura.Infrastructure.Processes;

namespace Obscura.Infrastructure.Tests;

public sealed class ThumbnailServiceTests : IDisposable {
    private readonly string _root = Path.Combine(Path.GetTempPath(), $"obscura-thumbnails-{Guid.NewGuid():N}");

    public ThumbnailServiceTests() {
        Directory.CreateDirectory(_root);
    }

    [Fact]
    public async Task TiledJpegComposerWritesAbsoluteConcatFramePaths() {
        var frameDir = Path.Combine(_root, "relative-root", "frames");
        var outputDir = Path.Combine(_root, "relative-root", "tiles");
        Directory.CreateDirectory(frameDir);
        await File.WriteAllTextAsync(Path.Combine(frameDir, "frame-00001.jpg"), "frame1");
        await File.WriteAllTextAsync(Path.Combine(frameDir, "frame-00002.jpg"), "frame2");
        var process = new CapturingProcessExecutor();
        var service = new ThumbnailService(process);

        var tileCount = await service.ComposeTiledJpegSheetsAsync(
            Path.GetRelativePath(Directory.GetCurrentDirectory(), frameDir),
            Path.GetRelativePath(Directory.GetCurrentDirectory(), outputDir),
            columns: 5,
            rows: 5,
            frameWidth: 320,
            frameHeight: 180,
            jpegQuality: 2,
            CancellationToken.None);

        Assert.Equal(1, tileCount);
        Assert.All(process.ConcatLines, line => {
            Assert.StartsWith("file '", line, StringComparison.Ordinal);
            Assert.True(Path.IsPathRooted(line[6..^1]));
        });
    }

    [Fact]
    public void AssetPathsNormalizeRelativeDataDirectoriesToAbsoluteCacheRoots() {
        var relativeDataDir = Path.GetRelativePath(
            Directory.GetCurrentDirectory(),
            Path.Combine(_root, "data"));

        var paths = new AssetPathService(relativeDataDir);

        Assert.Equal(
            Path.Combine(Path.GetFullPath(relativeDataDir), "cache"),
            paths.CacheRoot);
    }

    public void Dispose() {
        if (Directory.Exists(_root)) {
            Directory.Delete(_root, recursive: true);
        }
    }

    private sealed class CapturingProcessExecutor : ProcessExecutor {
        public IReadOnlyList<string> ConcatLines { get; private set; } = [];

        public override async Task<ProcessExecutionResult> RunAsync(
            string fileName,
            IReadOnlyList<string> arguments,
            IReadOnlyDictionary<string, string>? environment,
            CancellationToken cancellationToken) {
            var inputIndex = arguments.ToList().IndexOf("-i");
            Assert.True(inputIndex >= 0);
            ConcatLines = await File.ReadAllLinesAsync(arguments[inputIndex + 1], cancellationToken);
            var outputPath = arguments[^1];
            Directory.CreateDirectory(Path.GetDirectoryName(outputPath)!);
            await File.WriteAllTextAsync(outputPath, "tile", cancellationToken);
            return new ProcessExecutionResult(0, string.Empty, string.Empty);
        }
    }
}

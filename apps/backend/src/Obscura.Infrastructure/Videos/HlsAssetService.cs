using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;
using Obscura.Application.Videos;
using Obscura.Infrastructure.Processes;

namespace Obscura.Infrastructure.Videos;

/// <summary>
/// Filesystem-backed implementation that resolves generated HLS playback assets from the cache directory.
/// </summary>
public sealed class HlsAssetService : IHlsAssetService
{
    private static readonly ConcurrentDictionary<Guid, Task> ActiveGenerations = new();

    private readonly HlsAssetServiceOptions _options;
    private readonly IVideoSourceService? _sources;
    private readonly ProcessExecutor? _processes;
    private readonly ILogger<HlsAssetService>? _logger;

    /// <summary>
    /// Creates an HLS asset resolver rooted at the configured cache directory.
    /// </summary>
    /// <param name="options">Cache-root options for generated HLS packages.</param>
    public HlsAssetService(HlsAssetServiceOptions options)
    {
        _options = options;
    }

    /// <summary>
    /// Creates an HLS asset resolver that can also generate missing packages on demand.
    /// </summary>
    /// <param name="options">Cache-root options for generated HLS packages.</param>
    /// <param name="sources">Source video resolver used to locate the original media file.</param>
    /// <param name="processes">Process runner used to invoke ffmpeg.</param>
    /// <param name="logger">Logger for generation diagnostics.</param>
    public HlsAssetService(
        HlsAssetServiceOptions options,
        IVideoSourceService sources,
        ProcessExecutor processes,
        ILogger<HlsAssetService> logger)
    {
        _options = options;
        _sources = sources;
        _processes = processes;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<HlsAsset?> GetAssetAsync(
        Guid id,
        string assetPath,
        CancellationToken cancellationToken)
    {
        var normalizedAssetPath = NormalizeAssetPath(assetPath);
        if (normalizedAssetPath is null)
        {
            return null;
        }

        var existing = FindAsset(id, normalizedAssetPath);
        if (existing is not null) return existing;

        if (normalizedAssetPath.Equals("master.m3u8", StringComparison.OrdinalIgnoreCase))
        {
            await EnsureGenerationStartedAsync(id, cancellationToken);
            return await WaitForAssetAsync(id, normalizedAssetPath, cancellationToken);
        }

        return null;
    }

    private IEnumerable<string> CandidatePackageRoots(Guid id)
    {
        var cacheRoot = Path.GetFullPath(_options.CacheRoot);
        yield return Path.Combine(cacheRoot, "hls2", id.ToString());
        yield return Path.Combine(cacheRoot, "hls", id.ToString());
    }

    private HlsAsset? FindAsset(Guid id, string normalizedAssetPath)
    {
        foreach (var packageRoot in CandidatePackageRoots(id))
        {
            var resolved = ResolveInside(packageRoot, normalizedAssetPath);
            if (resolved is not null && File.Exists(resolved))
            {
                return new HlsAsset(
                    resolved,
                    MimeForExtension(Path.GetExtension(resolved)),
                    CacheControlForExtension(Path.GetExtension(resolved)));
            }
        }

        return null;
    }

    private async Task EnsureGenerationStartedAsync(Guid id, CancellationToken cancellationToken)
    {
        if (_sources is null || _processes is null)
        {
            return;
        }

        if (ActiveGenerations.ContainsKey(id))
        {
            return;
        }

        var source = await _sources.GetSourceAsync(id, cancellationToken);
        if (source is null)
        {
            return;
        }

        _ = ActiveGenerations.GetOrAdd(id, key =>
        {
            var task = Task.Run(() => GeneratePackageAsync(key, source.Path, CancellationToken.None));
            _ = task.ContinueWith(
                completedTask =>
                {
                    _ = completedTask;
                    _ = ActiveGenerations.TryRemove(key, out var _);
                },
                CancellationToken.None,
                TaskContinuationOptions.ExecuteSynchronously,
                TaskScheduler.Default);
            return task;
        });
    }

    private async Task<HlsAsset?> WaitForAssetAsync(
        Guid id,
        string normalizedAssetPath,
        CancellationToken cancellationToken)
    {
        var deadline = DateTimeOffset.UtcNow.AddSeconds(20);
        while (DateTimeOffset.UtcNow < deadline)
        {
            var asset = FindAsset(id, normalizedAssetPath);
            if (asset is not null)
            {
                return asset;
            }

            await Task.Delay(TimeSpan.FromMilliseconds(250), cancellationToken);
        }

        return null;
    }

    private async Task GeneratePackageAsync(Guid id, string sourcePath, CancellationToken cancellationToken)
    {
        if (_processes is null)
        {
            return;
        }

        var packageRoot = Path.Combine(Path.GetFullPath(_options.CacheRoot), "hls2", id.ToString());
        Directory.CreateDirectory(packageRoot);

        var segmentPattern = Path.Combine(packageRoot, "seg_%05d.ts");
        var manifestPath = Path.Combine(packageRoot, "master.m3u8");
        var result = await _processes.RunAsync(
            "ffmpeg",
            [
                "-hide_banner",
                "-y",
                "-i",
                sourcePath,
                "-map",
                "0:v:0",
                "-map",
                "0:a:0?",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "23",
                "-c:a",
                "aac",
                "-ac",
                "2",
                "-f",
                "hls",
                "-hls_time",
                "4",
                "-hls_list_size",
                "0",
                "-hls_flags",
                "independent_segments",
                "-hls_segment_filename",
                segmentPattern,
                manifestPath
            ],
            environment: null,
            cancellationToken);

        if (result.ExitCode != 0)
        {
            _logger?.LogWarning(
                "HLS generation failed for {VideoId}: {Error}",
                id,
                result.StandardError);
        }
    }

    private static string? NormalizeAssetPath(string assetPath)
    {
        var normalized = assetPath.Replace('\\', '/').TrimStart('/');
        if (string.IsNullOrWhiteSpace(normalized) ||
            normalized.Contains("..", StringComparison.Ordinal) ||
            Path.IsPathRooted(normalized))
        {
            return null;
        }

        return normalized;
    }

    private static string? ResolveInside(string root, string assetPath)
    {
        var rootFullPath = Path.GetFullPath(root);
        var resolved = Path.GetFullPath(Path.Combine(rootFullPath, assetPath));
        var rootWithSeparator = rootFullPath.EndsWith(Path.DirectorySeparatorChar)
            ? rootFullPath
            : rootFullPath + Path.DirectorySeparatorChar;

        return resolved == rootFullPath ||
            resolved.StartsWith(rootWithSeparator, StringComparison.Ordinal)
                ? resolved
                : null;
    }

    private static string MimeForExtension(string extension)
    {
        return extension.ToLowerInvariant() switch
        {
            ".m3u8" => "application/vnd.apple.mpegurl",
            ".ts" => "video/mp2t",
            ".mp4" or ".m4s" => "video/mp4",
            ".vtt" => "text/vtt",
            _ => "application/octet-stream"
        };
    }

    private static string CacheControlForExtension(string extension)
    {
        return extension.Equals(".m3u8", StringComparison.OrdinalIgnoreCase)
            ? "public, max-age=60"
            : "public, max-age=31536000, immutable";
    }
}

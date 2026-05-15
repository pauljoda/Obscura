using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Obscura.Application.Videos;
using Obscura.Infrastructure.Processes;

namespace Obscura.Infrastructure.Videos;

/// <summary>
/// Filesystem-backed implementation that resolves generated HLS playback assets from the cache directory.
/// </summary>
public sealed class HlsAssetService : IHlsAssetService
{
    private const int SegmentDurationSeconds = 6;
    private static readonly ConcurrentDictionary<string, Task<string>> ActiveSegments = new();

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

        var virtualAsset = await TryGetVirtualAssetAsync(id, normalizedAssetPath, cancellationToken);
        if (virtualAsset is not null)
        {
            return virtualAsset;
        }

        return FindAsset(id, normalizedAssetPath);
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

    private async Task<HlsAsset?> TryGetVirtualAssetAsync(
        Guid id,
        string normalizedAssetPath,
        CancellationToken cancellationToken)
    {
        if (_sources is null || _processes is null)
        {
            return null;
        }

        var source = await _sources.GetSourceAsync(id, cancellationToken);
        if (source is null || source.DurationSeconds is not > 0)
        {
            return null;
        }

        var renditions = RenditionsFor(source.Height);
        await EnsureVirtualCacheAsync(id, source, renditions, cancellationToken);

        if (normalizedAssetPath.Equals("master.m3u8", StringComparison.OrdinalIgnoreCase))
        {
            return await WriteTextAssetAsync(
                VirtualPath(id, "master.m3u8"),
                BuildVirtualMasterPlaylist(source, renditions),
                ".m3u8",
                cancellationToken);
        }

        var parts = normalizedAssetPath.Split('/');
        if (parts.Length == 3 &&
            parts[0].Equals("v", StringComparison.OrdinalIgnoreCase) &&
            parts[2].Equals("index.m3u8", StringComparison.OrdinalIgnoreCase))
        {
            var rendition = renditions.FirstOrDefault(candidate =>
                candidate.Name.Equals(parts[1], StringComparison.OrdinalIgnoreCase));
            if (rendition is null) return null;

            return await WriteTextAssetAsync(
                VirtualPath(id, "v", rendition.Name, "index.m3u8"),
                BuildVirtualVariantPlaylist(source.DurationSeconds.Value),
                ".m3u8",
                cancellationToken);
        }

        if (parts.Length == 3 && parts[0].Equals("v", StringComparison.OrdinalIgnoreCase))
        {
            var rendition = renditions.FirstOrDefault(candidate =>
                candidate.Name.Equals(parts[1], StringComparison.OrdinalIgnoreCase));
            var segmentIndex = ParseSegmentIndex(parts[2]);
            if (rendition is null || segmentIndex is null)
            {
                return null;
            }

            var segmentPath = await GetVirtualSegmentAsync(
                id,
                source,
                rendition,
                segmentIndex.Value,
                cancellationToken);

            return new HlsAsset(segmentPath, "video/mp2t", "public, max-age=31536000, immutable");
        }

        return null;
    }

    private async Task EnsureVirtualCacheAsync(
        Guid id,
        VideoSourceFile source,
        IReadOnlyList<VirtualHlsRendition> renditions,
        CancellationToken cancellationToken)
    {
        var root = VirtualRoot(id);
        var metaPath = Path.Combine(root, "metadata.json");
        var sourceInfo = new FileInfo(source.Path);
        var nextMeta = new VirtualCacheMetadata(
            source.Path,
            sourceInfo.Length,
            sourceInfo.LastWriteTimeUtc,
            source.DurationSeconds!.Value,
            renditions.Select(rendition => rendition.Name).ToArray());

        if (File.Exists(metaPath))
        {
            try
            {
                var existing = JsonSerializer.Deserialize<VirtualCacheMetadata>(
                    await File.ReadAllTextAsync(metaPath, cancellationToken));
                if (IsSameVirtualCache(existing, nextMeta))
                {
                    return;
                }
            }
            catch
            {
                // Invalid metadata is treated as stale cache.
            }

            Directory.Delete(root, recursive: true);
        }

        Directory.CreateDirectory(root);
        await File.WriteAllTextAsync(
            metaPath,
            JsonSerializer.Serialize(nextMeta, new JsonSerializerOptions { WriteIndented = true }),
            cancellationToken);
    }

    private async Task<HlsAsset> WriteTextAssetAsync(
        string path,
        string content,
        string extension,
        CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await File.WriteAllTextAsync(path, content, cancellationToken);
        return new HlsAsset(path, MimeForExtension(extension), CacheControlForExtension(extension));
    }

    private async Task<string> GetVirtualSegmentAsync(
        Guid id,
        VideoSourceFile source,
        VirtualHlsRendition rendition,
        int segmentIndex,
        CancellationToken cancellationToken)
    {
        if (segmentIndex < 0 || segmentIndex >= SegmentCount(source.DurationSeconds!.Value))
        {
            throw new FileNotFoundException("HLS segment index is outside the video duration.");
        }

        var outputPath = VirtualPath(id, "v", rendition.Name, $"seg_{segmentIndex:00000}.ts");
        if (File.Exists(outputPath) && new FileInfo(outputPath).Length > 0)
        {
            _ = PrefetchVirtualSegmentAsync(id, source, rendition, segmentIndex + 1);
            return outputPath;
        }

        var key = $"{id}/{rendition.Name}/{segmentIndex}";
        var segmentTask = ActiveSegments.GetOrAdd(
            key,
            _ => EncodeVirtualSegmentAsync(id, source, rendition, segmentIndex, outputPath, cancellationToken));

        try
        {
            var path = await segmentTask;
            _ = PrefetchVirtualSegmentAsync(id, source, rendition, segmentIndex + 1);
            return path;
        }
        finally
        {
            ActiveSegments.TryRemove(key, out var _);
        }
    }

    private Task PrefetchVirtualSegmentAsync(
        Guid id,
        VideoSourceFile source,
        VirtualHlsRendition rendition,
        int segmentIndex)
    {
        if (segmentIndex < 0 || segmentIndex >= SegmentCount(source.DurationSeconds!.Value))
        {
            return Task.CompletedTask;
        }

        var outputPath = VirtualPath(id, "v", rendition.Name, $"seg_{segmentIndex:00000}.ts");
        if (File.Exists(outputPath) && new FileInfo(outputPath).Length > 0)
        {
            return Task.CompletedTask;
        }

        var key = $"{id}/{rendition.Name}/{segmentIndex}";
        ActiveSegments.GetOrAdd(
            key,
            _ => EncodeVirtualSegmentAsync(id, source, rendition, segmentIndex, outputPath, CancellationToken.None));
        return Task.CompletedTask;
    }

    private async Task<string> EncodeVirtualSegmentAsync(
        Guid id,
        VideoSourceFile source,
        VirtualHlsRendition rendition,
        int segmentIndex,
        string outputPath,
        CancellationToken cancellationToken)
    {
        if (_processes is null)
        {
            throw new InvalidOperationException("HLS segment encoding requires a process executor.");
        }

        Directory.CreateDirectory(Path.GetDirectoryName(outputPath)!);
        var tempPath = $"{outputPath}.{Guid.NewGuid():N}.tmp";
        var segmentStart = segmentIndex * SegmentDurationSeconds;
        var result = await _processes.RunAsync(
            "ffmpeg",
            VirtualSegmentArguments(source.Path, rendition, segmentStart, tempPath),
            environment: null,
            cancellationToken);

        if (result.ExitCode != 0)
        {
            File.Delete(tempPath);
            _logger?.LogWarning(
                "Virtual HLS segment generation failed for {VideoId} segment {Segment}: {Error}",
                id,
                segmentIndex,
                result.StandardError);
            throw new InvalidOperationException("HLS segment generation failed.");
        }

        if (!File.Exists(tempPath) || new FileInfo(tempPath).Length == 0)
        {
            File.Delete(tempPath);
            throw new InvalidOperationException("HLS segment generation produced an empty file.");
        }

        File.Move(tempPath, outputPath, overwrite: true);
        return outputPath;
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

    private string VirtualRoot(Guid id) =>
        Path.Combine(Path.GetFullPath(_options.CacheRoot), "hlsv", id.ToString());

    private string VirtualPath(Guid id, params string[] parts) =>
        Path.Combine([VirtualRoot(id), .. parts]);

    private static IReadOnlyList<VirtualHlsRendition> RenditionsFor(int? sourceHeight)
    {
        var height = sourceHeight ?? 720;
        if (height >= 720)
        {
            return
            [
                new("720p", 720, "2800k", "3200k", "5600k", "128k", 20)
            ];
        }

        if (height >= 480)
        {
            return
            [
                new("480p", 480, "1400k", "1800k", "2800k", "128k", 21)
            ];
        }

        return
        [
            new("360p", 360, "800k", "1000k", "1600k", "96k", 22)
        ];
    }

    private static string BuildVirtualMasterPlaylist(
        VideoSourceFile source,
        IReadOnlyList<VirtualHlsRendition> renditions)
    {
        var lines = new List<string> { "#EXTM3U", "#EXT-X-VERSION:6" };
        foreach (var rendition in renditions)
        {
            var width = ScaledWidth(source.Width, source.Height, rendition.Height);
            var resolution = width is null ? "" : $",RESOLUTION={width}x{rendition.Height}";
            lines.Add(
                $"#EXT-X-STREAM-INF:BANDWIDTH={ToBitsPerSecond(rendition.MaxRate)},AVERAGE-BANDWIDTH={ToBitsPerSecond(rendition.VideoBitrate)}{resolution},CODECS=\"avc1.4d401f,mp4a.40.2\"");
            lines.Add($"v/{rendition.Name}/index.m3u8");
        }

        lines.Add(string.Empty);
        return string.Join('\n', lines);
    }

    private static string BuildVirtualVariantPlaylist(double durationSeconds)
    {
        var lines = new List<string>
        {
            "#EXTM3U",
            "#EXT-X-VERSION:6",
            "#EXT-X-PLAYLIST-TYPE:VOD",
            $"#EXT-X-TARGETDURATION:{SegmentDurationSeconds + 1}",
            "#EXT-X-MEDIA-SEQUENCE:0",
            "#EXT-X-INDEPENDENT-SEGMENTS"
        };

        var total = SegmentCount(durationSeconds);
        for (var index = 0; index < total; index++)
        {
            lines.Add($"#EXTINF:{SegmentDuration(durationSeconds, index):0.000},");
            lines.Add($"seg_{index:00000}.ts");
        }

        lines.Add("#EXT-X-ENDLIST");
        lines.Add(string.Empty);
        return string.Join('\n', lines);
    }

    private static IReadOnlyList<string> VirtualSegmentArguments(
        string sourcePath,
        VirtualHlsRendition rendition,
        int segmentStart,
        string outputPath) =>
        [
            "-hide_banner",
            "-y",
            "-loglevel",
            "error",
            "-nostats",
            "-ss",
            segmentStart.ToString("0.000"),
            "-i",
            sourcePath,
            "-t",
            SegmentDurationSeconds.ToString(),
            "-vf",
            $"scale=w=-2:h={rendition.Height}:force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p",
            "-map",
            "0:v:0",
            "-map",
            "0:a:0?",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            rendition.Crf.ToString(),
            "-profile:v",
            "main",
            "-pix_fmt",
            "yuv420p",
            "-g",
            "144",
            "-keyint_min",
            "144",
            "-sc_threshold",
            "0",
            "-b:v",
            rendition.VideoBitrate,
            "-maxrate",
            rendition.MaxRate,
            "-bufsize",
            rendition.BufferSize,
            "-c:a",
            "aac",
            "-b:a",
            rendition.AudioBitrate,
            "-ac",
            "2",
            "-ar",
            "48000",
            "-output_ts_offset",
            segmentStart.ToString("0.000"),
            "-muxdelay",
            "0",
            "-muxpreload",
            "0",
            "-f",
            "mpegts",
            outputPath
        ];

    private static int SegmentCount(double durationSeconds) =>
        !double.IsFinite(durationSeconds) || durationSeconds <= 0
            ? 0
            : (int)Math.Ceiling(durationSeconds / SegmentDurationSeconds);

    private static double SegmentDuration(double durationSeconds, int index)
    {
        var total = SegmentCount(durationSeconds);
        if (index < 0 || index >= total) return 0;
        if (index < total - 1) return SegmentDurationSeconds;
        var duration = durationSeconds - (total - 1) * SegmentDurationSeconds;
        return duration > 0 ? duration : SegmentDurationSeconds;
    }

    private static int ToBitsPerSecond(string rate)
    {
        var value = rate.Trim();
        var unit = value[^1];
        if (unit is 'k' or 'K' or 'm' or 'M')
        {
            var number = int.TryParse(value[..^1], out var parsed) ? parsed : 0;
            return unit is 'm' or 'M' ? number * 1_000_000 : number * 1_000;
        }

        return int.TryParse(value, out var raw) ? raw : 0;
    }

    private static int? ScaledWidth(int? sourceWidth, int? sourceHeight, int targetHeight)
    {
        if (sourceWidth is not > 0 || sourceHeight is not > 0 || targetHeight <= 0) return null;
        var width = (int)Math.Round((double)sourceWidth.Value / sourceHeight.Value * targetHeight);
        return width % 2 == 0 ? width : width - 1;
    }

    private static int? ParseSegmentIndex(string fileName)
    {
        if (!fileName.StartsWith("seg_", StringComparison.OrdinalIgnoreCase) ||
            !fileName.EndsWith(".ts", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var value = fileName["seg_".Length..^".ts".Length];
        return int.TryParse(value, out var index) ? index : null;
    }

    private static bool IsSameVirtualCache(
        VirtualCacheMetadata? left,
        VirtualCacheMetadata right) =>
        left is not null &&
        left.SourcePath == right.SourcePath &&
        left.SourceSize == right.SourceSize &&
        left.SourceModifiedUtc == right.SourceModifiedUtc &&
        Math.Abs(left.DurationSeconds - right.DurationSeconds) < 0.001 &&
        left.Renditions.SequenceEqual(right.Renditions);

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

    private sealed record VirtualHlsRendition(
        string Name,
        int Height,
        string VideoBitrate,
        string MaxRate,
        string BufferSize,
        string AudioBitrate,
        int Crf);

    private sealed record VirtualCacheMetadata(
        string SourcePath,
        long SourceSize,
        DateTime SourceModifiedUtc,
        double DurationSeconds,
        IReadOnlyList<string> Renditions);
}

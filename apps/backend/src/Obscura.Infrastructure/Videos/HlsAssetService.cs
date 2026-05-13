using Obscura.Application.Videos;

namespace Obscura.Infrastructure.Videos;

/// <summary>
/// Filesystem-backed implementation that resolves generated HLS playback assets from the cache directory.
/// </summary>
public sealed class HlsAssetService : IHlsAssetService
{
    private readonly HlsAssetServiceOptions _options;

    /// <summary>
    /// Creates an HLS asset resolver rooted at the configured cache directory.
    /// </summary>
    /// <param name="options">Cache-root options for generated HLS packages.</param>
    public HlsAssetService(HlsAssetServiceOptions options)
    {
        _options = options;
    }

    /// <inheritdoc />
    public Task<HlsAsset?> GetAssetAsync(
        Guid id,
        string assetPath,
        CancellationToken cancellationToken)
    {
        var normalizedAssetPath = NormalizeAssetPath(assetPath);
        if (normalizedAssetPath is null)
        {
            return Task.FromResult<HlsAsset?>(null);
        }

        foreach (var packageRoot in CandidatePackageRoots(id))
        {
            var resolved = ResolveInside(packageRoot, normalizedAssetPath);
            if (resolved is not null && File.Exists(resolved))
            {
                return Task.FromResult<HlsAsset?>(new HlsAsset(
                    resolved,
                    MimeForExtension(Path.GetExtension(resolved)),
                    CacheControlForExtension(Path.GetExtension(resolved))));
            }
        }

        return Task.FromResult<HlsAsset?>(null);
    }

    private IEnumerable<string> CandidatePackageRoots(Guid id)
    {
        var cacheRoot = Path.GetFullPath(_options.CacheRoot);
        yield return Path.Combine(cacheRoot, "hls2", id.ToString());
        yield return Path.Combine(cacheRoot, "hls", id.ToString());
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

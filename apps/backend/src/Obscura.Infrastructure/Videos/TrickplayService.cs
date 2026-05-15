using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Obscura.Application.Videos;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Videos;

/// <summary>
/// Filesystem-backed Jellyfin-style trickplay playlist and tile resolver.
/// </summary>
public sealed class TrickplayService : ITrickplayService
{
    private const int DefaultTileColumns = 5;
    private const int DefaultTileRows = 5;
    private const double DefaultIntervalSeconds = 10;
    private readonly string _cacheRoot;
    private readonly ObscuraDbContext? _db;

    public TrickplayService(HlsAssetServiceOptions options)
    {
        _cacheRoot = Path.GetFullPath(options.CacheRoot);
    }

    public TrickplayService(HlsAssetServiceOptions options, ObscuraDbContext db)
        : this(options)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<TrickplayPlaylist?> GetPlaylistAsync(Guid itemId, int width, CancellationToken cancellationToken)
    {
        if (width <= 0)
        {
            return null;
        }

        var root = TrickplayRoot(itemId, width);
        var playlistPath = Path.Combine(root, "tiles.m3u8");
        if (File.Exists(playlistPath))
        {
            return new TrickplayPlaylist(
                await File.ReadAllTextAsync(playlistPath, cancellationToken),
                "public, max-age=60");
        }

        if (!Directory.Exists(root))
        {
            return null;
        }

        var tiles = Directory.EnumerateFiles(root, "*.jpg")
            .Select(path => new { Path = path, Index = ParseTileIndex(path) })
            .Where(tile => tile.Index is not null)
            .OrderBy(tile => tile.Index)
            .ToList();
        if (tiles.Count == 0)
        {
            return null;
        }

        var info = await GetInfoAsync(itemId, width, tiles.Count, cancellationToken);
        return new TrickplayPlaylist(BuildImagesOnlyPlaylist(tiles.Count, info), "public, max-age=60");
    }

    /// <inheritdoc />
    public Task<TrickplayTile?> GetTileAsync(Guid itemId, int width, int index, CancellationToken cancellationToken)
    {
        if (width <= 0 || index < 0)
        {
            return Task.FromResult<TrickplayTile?>(null);
        }

        var path = Path.Combine(TrickplayRoot(itemId, width), $"{index}.jpg");
        var resolved = ResolveInside(TrickplayRoot(itemId, width), $"{index}.jpg");
        return Task.FromResult(resolved is not null && File.Exists(path)
            ? new TrickplayTile(path, "image/jpeg", "public, max-age=31536000, immutable")
            : null);
    }

    private string TrickplayRoot(Guid itemId, int width) =>
        Path.Combine(_cacheRoot, "trickplay", itemId.ToString(), width.ToString(CultureInfo.InvariantCulture));

    private async Task<TrickplayInfoRow> GetInfoAsync(
        Guid itemId,
        int width,
        int tileCount,
        CancellationToken cancellationToken)
    {
        if (_db is not null)
        {
            var persisted = await _db.TrickplayInfos.AsNoTracking()
                .FirstOrDefaultAsync(row => row.EntityId == itemId && row.Width == width, cancellationToken);
            if (persisted is not null)
            {
                return persisted;
            }
        }

        return new TrickplayInfoRow
        {
            EntityId = itemId,
            Width = width,
            Height = Math.Max(1, (int)Math.Round(width * 9 / 16d)),
            TileWidth = DefaultTileColumns,
            TileHeight = DefaultTileRows,
            ThumbnailCount = tileCount * DefaultTileColumns * DefaultTileRows,
            IntervalSeconds = DefaultIntervalSeconds,
            Bandwidth = 0
        };
    }

    private static string BuildImagesOnlyPlaylist(int tileCount, TrickplayInfoRow info)
    {
        var durationPerTile = info.IntervalSeconds * info.TileWidth * info.TileHeight;
        var lines = new List<string>
        {
            "#EXTM3U",
            "#EXT-X-VERSION:7",
            "#EXT-X-PLAYLIST-TYPE:VOD",
            "#EXT-X-IMAGES-ONLY",
            $"#EXT-X-TARGETDURATION:{Math.Max(1, (int)Math.Ceiling(durationPerTile))}",
            $"#EXT-X-TILES:RESOLUTION={info.Width}x{info.Height},LAYOUT={info.TileWidth}x{info.TileHeight},DURATION={info.IntervalSeconds:0.###}"
        };

        for (var index = 0; index < tileCount; index++)
        {
            lines.Add($"#EXTINF:{durationPerTile:0.###},");
            lines.Add($"{index}.jpg");
        }

        lines.Add("#EXT-X-ENDLIST");
        lines.Add(string.Empty);
        return string.Join('\n', lines);
    }

    private static int? ParseTileIndex(string path)
    {
        var name = Path.GetFileNameWithoutExtension(path);
        return int.TryParse(name, NumberStyles.None, CultureInfo.InvariantCulture, out var index) ? index : null;
    }

    private static string? ResolveInside(string root, string assetPath)
    {
        var rootFullPath = Path.GetFullPath(root);
        var resolved = Path.GetFullPath(Path.Combine(rootFullPath, assetPath));
        var rootWithSeparator = rootFullPath.EndsWith(Path.DirectorySeparatorChar)
            ? rootFullPath
            : rootFullPath + Path.DirectorySeparatorChar;

        return resolved.StartsWith(rootWithSeparator, StringComparison.Ordinal) ? resolved : null;
    }
}

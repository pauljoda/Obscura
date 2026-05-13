using Microsoft.Extensions.Logging;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Performs library maintenance: validates generated cache assets exist on disk
/// and removes orphaned cache directories whose entities no longer exist.
/// </summary>
public sealed class LibraryMaintenanceJobHandler(
    ILogger<LibraryMaintenanceJobHandler> logger,
    IMaintenancePersistence persistence,
    IMediaAssetGenerator assets) : IJobHandler
{
    public JobType Type => JobType.LibraryMaintenance;

    private static readonly (string KindCode, string CacheSubdir)[] AssetKinds =
    [
        ("video", "videos"),
        ("image", "images"),
        ("book-page", "book-pages"),
        ("audio-track", "audio-tracks")
    ];

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        await context.ReportProgressAsync(5, "Starting maintenance", cancellationToken);

        var totalOrphansRemoved = 0;
        var totalMissingAssets = 0;
        var progressPerKind = 90 / AssetKinds.Length;

        for (var i = 0; i < AssetKinds.Length; i++)
        {
            var (kindCode, cacheSubdir) = AssetKinds[i];

            var entityIds = await persistence.GetActiveEntityIdsByKindAsync(kindCode, cancellationToken);
            var activeIdSet = new HashSet<string>(entityIds.Select(id => id.ToString()), StringComparer.OrdinalIgnoreCase);

            var missing = ValidateAssets(kindCode, entityIds);
            totalMissingAssets += missing;

            var orphans = CleanOrphanedCacheDirs(cacheSubdir, activeIdSet);
            totalOrphansRemoved += orphans;

            var progress = 5 + ((i + 1) * progressPerKind);
            await context.ReportProgressAsync(progress,
                $"{kindCode}: {entityIds.Count} entities, {missing} missing assets, {orphans} orphans cleaned",
                cancellationToken);
        }

        logger.LogInformation(
            "LibraryMaintenance complete: {MissingAssets} missing assets found, {OrphansRemoved} orphaned cache dirs removed",
            totalMissingAssets, totalOrphansRemoved);

        await context.ReportProgressAsync(100,
            $"Maintenance complete: {totalMissingAssets} missing, {totalOrphansRemoved} orphans cleaned",
            cancellationToken);
    }

    private int ValidateAssets(string kindCode, IReadOnlyList<Guid> entityIds)
    {
        var missing = 0;

        foreach (var id in entityIds)
        {
            var expectedPaths = GetExpectedAssetPaths(kindCode, id);
            foreach (var path in expectedPaths)
            {
                if (!File.Exists(path))
                {
                    missing++;
                    logger.LogDebug("Missing asset for {Kind} {EntityId}: {Path}", kindCode, id, path);
                }
            }
        }

        return missing;
    }

    private IReadOnlyList<string> GetExpectedAssetPaths(string kindCode, Guid entityId) =>
        kindCode switch
        {
            "video" => [assets.VideoThumbnailPath(entityId)],
            "image" => [assets.ImageThumbnailPath(entityId)],
            "book-page" => [assets.BookPageThumbnailPath(entityId)],
            "audio-track" => [assets.AudioWaveformPath(entityId)],
            _ => []
        };

    private int CleanOrphanedCacheDirs(string cacheSubdir, HashSet<string> activeIdSet)
    {
        var cacheBase = persistence.GetCacheBasePath();
        var kindCacheDir = Path.Combine(cacheBase, cacheSubdir);
        if (!Directory.Exists(kindCacheDir)) return 0;

        var orphans = 0;
        foreach (var dir in Directory.GetDirectories(kindCacheDir))
        {
            var dirName = Path.GetFileName(dir);
            if (activeIdSet.Contains(dirName)) continue;

            try
            {
                Directory.Delete(dir, recursive: true);
                orphans++;
                logger.LogInformation("Removed orphaned cache dir: {Path}", dir);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to remove orphaned cache dir: {Path}", dir);
            }
        }

        return orphans;
    }
}

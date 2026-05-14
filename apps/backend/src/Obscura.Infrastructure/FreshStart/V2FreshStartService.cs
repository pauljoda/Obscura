using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Obscura.Application.Migrations;
using Obscura.Infrastructure.Backups;
using Obscura.Infrastructure.Persistence;

namespace Obscura.Infrastructure.FreshStart;

public sealed class V2FreshStartService : IV2FreshStartService
{
    private readonly ObscuraDbContext _db;
    private readonly DatabaseBackupService _backupService;
    private readonly string _cacheDir;
    private readonly ILogger<V2FreshStartService> _logger;

    public V2FreshStartService(
        ObscuraDbContext db,
        DatabaseBackupService backupService,
        string cacheDir,
        ILogger<V2FreshStartService> logger)
    {
        _db = db;
        _backupService = backupService;
        _cacheDir = cacheDir;
        _logger = logger;
    }

    public async Task<V2FreshStartResult> PrepareAsync(CancellationToken cancellationToken)
    {
        var backup = await _backupService.CreateBackupAsync(cancellationToken);

        await _db.Database.ExecuteSqlRawAsync(FreshStartSql.PreserveConfiguration, cancellationToken);
        var preservedRoots = await _db.LibraryRoots.CountAsync(cancellationToken);
        var preservedSettings = await _db.LibrarySettings.AnyAsync(cancellationToken);

        var cachePurged = PurgeStaleCacheDirectories();

        return new V2FreshStartResult(
            backup.BackupPath,
            preservedRoots,
            preservedSettings,
            MediaReset: true,
            CachePurged: cachePurged);
    }

    /// <inheritdoc />
    public async Task ResetAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Resetting all v2 data for development gate re-arm");

        await _db.Database.ExecuteSqlRawAsync(FreshStartSql.ResetAllV2Data, cancellationToken);
        _logger.LogInformation("Truncated all v2 schema tables");

        PurgeStaleCacheDirectories();
    }

    /// <summary>
    /// Deletes stale v1 cache subdirectories whose entity IDs no longer correspond to
    /// v2 entities. After migration, a library rescan regenerates all cache assets under
    /// the correct v2 entity IDs. This reclaims disk space from orphaned thumbnails,
    /// previews, trickplay sprites, and waveforms.
    /// </summary>
    private bool PurgeStaleCacheDirectories()
    {
        if (!Directory.Exists(_cacheDir))
        {
            _logger.LogInformation("Cache directory does not exist, nothing to purge: {CacheDir}", _cacheDir);
            return false;
        }

        var purgedCount = 0;
        long freedBytes = 0;

        foreach (var subDir in Directory.EnumerateDirectories(_cacheDir))
        {
            try
            {
                var dirSize = GetDirectorySize(subDir);
                Directory.Delete(subDir, recursive: true);
                purgedCount++;
                freedBytes += dirSize;
            }
            catch (IOException ex)
            {
                _logger.LogWarning(ex, "Failed to purge cache subdirectory: {Path}", subDir);
            }
        }

        var freedMb = freedBytes / (1024.0 * 1024.0);
        _logger.LogInformation(
            "Purged {Count} stale cache directories, freed {FreedMb:F1} MB",
            purgedCount, freedMb);

        return purgedCount > 0;
    }

    private static long GetDirectorySize(string path)
    {
        long size = 0;
        try
        {
            foreach (var file in Directory.EnumerateFiles(path, "*", SearchOption.AllDirectories))
            {
                try { size += new FileInfo(file).Length; }
                catch (IOException) { /* skip inaccessible files */ }
            }
        }
        catch (IOException) { /* skip inaccessible directories */ }
        return size;
    }
}

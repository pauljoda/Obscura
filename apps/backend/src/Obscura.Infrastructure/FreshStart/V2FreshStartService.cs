using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Obscura.Application.Migrations;
using Obscura.Infrastructure.Backups;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.FreshStart;

public sealed class V2FreshStartService : IV2FreshStartService
{
    private const string PreparedPreferenceKey = "system:v2-fresh-start:v2-global-entities:prepared";
    private static readonly HashSet<string> GeneratedCacheSubdirectories = new(StringComparer.OrdinalIgnoreCase)
    {
        "audio-tracks",
        "book-pages",
        "hls",
        "hlsv",
        "images",
        "trickplay",
        "videos"
    };

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
        var existingResult = await GetExistingPreparationResultAsync(cancellationToken);
        if (existingResult is not null)
        {
            return existingResult;
        }

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
    public async Task MarkPreparedAsync(CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var row = await _db.UiPreferences.FindAsync([PreparedPreferenceKey], cancellationToken);
        if (row is null)
        {
            _db.UiPreferences.Add(new UiPreferenceRow
            {
                Key = PreparedPreferenceKey,
                ValueJson = """{"prepared":true}""",
                UpdatedAt = now
            });
        }
        else
        {
            row.ValueJson = """{"prepared":true}""";
            row.UpdatedAt = now;
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task ClearPreparedAsync(CancellationToken cancellationToken)
    {
        var row = await _db.UiPreferences.FindAsync([PreparedPreferenceKey], cancellationToken);
        if (row is null)
        {
            return;
        }

        _db.UiPreferences.Remove(row);
        await _db.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task ResetAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Resetting all v2 data for development gate re-arm");

        await _db.Database.ExecuteSqlRawAsync(FreshStartSql.ResetAllV2Data, cancellationToken);
        await ClearPreparedAsync(cancellationToken);
        _logger.LogInformation("Truncated all v2 schema tables");

        PurgeStaleCacheDirectories();
    }

    /// <inheritdoc />
    public async Task PurgeNonSourceEntityFilesAsync(CancellationToken cancellationToken)
    {
        var deleted = await _db.Database.ExecuteSqlRawAsync(
            FreshStartSql.PurgeNonSourceEntityFiles, cancellationToken);
        if (deleted > 0)
        {
            _logger.LogInformation(
                "Purged {Count} non-source entity_files rows left over from legacy import",
                deleted);
        }
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

        foreach (var subDir in Directory.EnumerateDirectories(_cacheDir).Where(ShouldPurgeCacheSubdirectory))
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

    internal static bool ShouldPurgeCacheSubdirectory(string path) =>
        GeneratedCacheSubdirectories.Contains(Path.GetFileName(Path.TrimEndingDirectorySeparator(path)));

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

    private async Task<bool> IsMarkedPreparedAsync(CancellationToken cancellationToken)
    {
        return await _db.UiPreferences.FindAsync([PreparedPreferenceKey], cancellationToken) is not null;
    }

    private async Task<V2FreshStartResult?> GetExistingPreparationResultAsync(CancellationToken cancellationToken)
    {
        var roots = await _db.LibraryRoots.CountAsync(cancellationToken);
        var hasSettings = await _db.LibrarySettings.AnyAsync(cancellationToken);
        var isMarkedPrepared = await IsMarkedPreparedAsync(cancellationToken);

        if (!isMarkedPrepared && (!hasSettings || roots == 0))
        {
            return null;
        }

        if (!isMarkedPrepared)
        {
            _logger.LogInformation(
                "Marking v2 fresh-start as prepared because preserved settings and library roots already exist");
            await MarkPreparedAsync(cancellationToken);
        }
        else
        {
            _logger.LogInformation("Skipping v2 fresh-start prepare because it has already completed");
        }

        return new V2FreshStartResult(
            BackupPath: string.Empty,
            PreservedLibraryRoots: roots,
            PreservedSettings: hasSettings,
            MediaReset: false,
            CachePurged: false)
        {
            AlreadyPrepared = true
        };
    }

}

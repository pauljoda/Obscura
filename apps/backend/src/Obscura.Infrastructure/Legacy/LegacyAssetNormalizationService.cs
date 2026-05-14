using Microsoft.Extensions.Logging;
using Npgsql;
using Obscura.Application.Migrations;

namespace Obscura.Infrastructure.Legacy;

/// <summary>
/// Normalizes legacy v1 extensionless asset paths to v2 standard format (with file extensions)
/// in <c>v2.entity_files</c>, then renames the corresponding files on disk.
/// </summary>
public sealed class LegacyAssetNormalizationService : ILegacyAssetNormalizationService
{
    private readonly NpgsqlDataSource _dataSource;
    private readonly string _cacheDir;
    private readonly ILogger<LegacyAssetNormalizationService> _logger;

    public LegacyAssetNormalizationService(
        NpgsqlDataSource dataSource,
        string cacheDir,
        ILogger<LegacyAssetNormalizationService> logger)
    {
        _dataSource = dataSource;
        _cacheDir = cacheDir;
        _logger = logger;
    }

    public async Task<LegacyAssetNormalizationResult> NormalizeAsync(CancellationToken cancellationToken)
    {
        var renameMap = new List<(string OldDisk, string NewDisk)>();

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        // Phase 1: Collect old→new path pairs before the UPDATE for disk renames.
        await using (var queryCmd = new NpgsqlCommand(RenameMapQuery, connection, transaction))
        await using (var reader = await queryCmd.ExecuteReaderAsync(cancellationToken))
        {
            while (await reader.ReadAsync(cancellationToken))
            {
                var oldPath = reader.GetString(0);
                var newPath = reader.GetString(1);

                if (oldPath != newPath)
                {
                    renameMap.Add((UrlToDiskPath(oldPath), UrlToDiskPath(newPath)));
                }
            }
        }

        // Phase 2: Bulk-update all extensionless /assets/ paths in the database.
        int pathsNormalized;
        await using (var updateCmd = new NpgsqlCommand(NormalizeSql, connection, transaction))
        {
            pathsNormalized = await updateCmd.ExecuteNonQueryAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);

        _logger.LogInformation("Normalized {Count} legacy asset paths in entity_files", pathsNormalized);

        // Phase 3: Rename files on disk from v1 names to v2 names.
        var filesRenamed = 0;
        foreach (var (oldDisk, newDisk) in renameMap)
        {
            try
            {
                if (File.Exists(oldDisk) && !File.Exists(newDisk))
                {
                    var dir = Path.GetDirectoryName(newDisk);
                    if (dir is not null && !Directory.Exists(dir))
                    {
                        Directory.CreateDirectory(dir);
                    }

                    File.Move(oldDisk, newDisk);
                    filesRenamed++;
                }
            }
            catch (IOException ex)
            {
                _logger.LogWarning(ex, "Failed to rename asset {OldPath} → {NewPath}", oldDisk, newDisk);
            }
        }

        _logger.LogInformation("Renamed {Count} legacy asset files on disk", filesRenamed);

        return new LegacyAssetNormalizationResult(pathsNormalized, filesRenamed);
    }

    private string UrlToDiskPath(string urlPath)
    {
        var relative = urlPath.StartsWith("/assets/", StringComparison.Ordinal)
            ? urlPath["/assets/".Length..]
            : urlPath;
        return Path.Combine(_cacheDir, relative);
    }

    /// <summary>
    /// Selects extensionless /assets/ paths with their computed v2 equivalents for building
    /// the disk rename map. Must run BEFORE the normalize UPDATE within the same transaction.
    /// </summary>
    private const string RenameMapQuery = """
        SELECT path AS old_path,
          CASE
            WHEN role = 'thumbnail' AND path ~ '/assets/videos/[^/]+/card$'
              THEN regexp_replace(path, '/card$', '/thumb.jpg')
            WHEN role IN ('thumbnail', 'sprite', 'poster', 'backdrop', 'cover')
              THEN path || '.jpg'
            WHEN role = 'preview'
              THEN path || '.mp4'
            WHEN role = 'trickplay'
              THEN path || '.vtt'
            WHEN role = 'logo'
              THEN path || '.png'
            WHEN role = 'waveform'
              THEN path || '.json'
            ELSE path
          END AS new_path
        FROM v2.entity_files
        WHERE path LIKE '/assets/%'
          AND path !~ '\.[a-zA-Z0-9]+$'
        """;

    /// <summary>
    /// Bulk UPDATE that normalizes all extensionless /assets/ paths in v2.entity_files.
    /// Video thumbnails get a basename rename (card → thumb.jpg); everything else gets
    /// the correct extension appended based on role.
    /// </summary>
    private const string NormalizeSql = """
        -- Video thumbnails: /assets/videos/{id}/card → /assets/videos/{id}/thumb.jpg
        UPDATE v2.entity_files
        SET path = regexp_replace(path, '/card$', '/thumb.jpg')
        WHERE role = 'thumbnail'
          AND path ~ '/assets/videos/[^/]+/card$';

        -- Remaining thumbnails, sprites, posters, backdrops, covers: append .jpg
        UPDATE v2.entity_files
        SET path = path || '.jpg'
        WHERE role IN ('thumbnail', 'sprite', 'poster', 'backdrop', 'cover')
          AND path LIKE '/assets/%'
          AND path !~ '\.[a-zA-Z0-9]+$';

        -- Previews: append .mp4
        UPDATE v2.entity_files
        SET path = path || '.mp4'
        WHERE role = 'preview'
          AND path LIKE '/assets/%'
          AND path !~ '\.[a-zA-Z0-9]+$';

        -- Trickplay VTTs: append .vtt
        UPDATE v2.entity_files
        SET path = path || '.vtt'
        WHERE role = 'trickplay'
          AND path LIKE '/assets/%'
          AND path !~ '\.[a-zA-Z0-9]+$';

        -- Logos: append .png
        UPDATE v2.entity_files
        SET path = path || '.png'
        WHERE role = 'logo'
          AND path LIKE '/assets/%'
          AND path !~ '\.[a-zA-Z0-9]+$';

        -- Waveforms: append .json
        UPDATE v2.entity_files
        SET path = path || '.json'
        WHERE role = 'waveform'
          AND path LIKE '/assets/%'
          AND path !~ '\.[a-zA-Z0-9]+$';
        """;
}

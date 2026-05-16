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
    private const string VideoSeasonKind = "video-season";
    private const string VideoSeriesKind = "video-series";
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

        // Phase 4: Detect v1 "-custom" filename convention and mark those rows as custom source.
        // Runs after path normalization so both old (extensionless) and new (with extension) forms
        // are caught by the LIKE pattern.
        int customFilesDetected;
        await using var conn2 = await _dataSource.OpenConnectionAsync(cancellationToken);
        await using (var customCmd = new NpgsqlCommand(MarkCustomSourceSql, conn2))
        {
            customFilesDetected = await customCmd.ExecuteNonQueryAsync(cancellationToken);
        }

        if (customFilesDetected > 0)
            _logger.LogInformation("Marked {Count} legacy entity files as custom source", customFilesDetected);

        var filesHydrated = await HydrateMissingLegacyArtworkAsync(cancellationToken);
        if (filesHydrated > 0)
            _logger.LogInformation("Hydrated {Count} missing legacy artwork files from source folders", filesHydrated);

        return new LegacyAssetNormalizationResult(pathsNormalized, filesRenamed, customFilesDetected);
    }

    private async Task<int> HydrateMissingLegacyArtworkAsync(CancellationToken cancellationToken)
    {
        var rows = new List<LegacyArtworkRow>();

        await using (var connection = await _dataSource.OpenConnectionAsync(cancellationToken))
        await using (var command = new NpgsqlCommand(MissingLegacyArtworkQuery, connection))
        await using (var reader = await command.ExecuteReaderAsync(cancellationToken))
        {
            while (await reader.ReadAsync(cancellationToken))
            {
                rows.Add(new LegacyArtworkRow(
                    reader.GetString(0),
                    reader.GetString(1),
                    reader.GetString(2),
                    reader.IsDBNull(3) ? null : reader.GetString(3),
                    reader.IsDBNull(4) ? null : reader.GetInt32(4)));
            }
        }

        var hydrated = 0;
        foreach (var row in rows)
        {
            var destination = UrlToDiskPath(row.UrlPath);
            if (File.Exists(destination))
            {
                continue;
            }

            var sourceFolder = NormalizeSourceFolderPath(row.SourceFolder);
            if (sourceFolder is null)
            {
                continue;
            }

            var source = LegacyArtworkCandidates(row.KindCode, row.Role, sourceFolder, row.SeasonNumber)
                .FirstOrDefault(File.Exists);
            if (source is null)
            {
                continue;
            }

            try
            {
                var destinationDir = Path.GetDirectoryName(destination);
                if (destinationDir is not null && !Directory.Exists(destinationDir))
                {
                    Directory.CreateDirectory(destinationDir);
                }

                File.Copy(source, destination, overwrite: false);
                hydrated++;
            }
            catch (IOException ex)
            {
                _logger.LogWarning(ex, "Failed to hydrate legacy artwork {SourcePath} → {DestinationPath}", source, destination);
            }
        }

        return hydrated;
    }

    private static string? NormalizeSourceFolderPath(string? sourcePath)
    {
        if (string.IsNullOrWhiteSpace(sourcePath))
        {
            return null;
        }

        if (Directory.Exists(sourcePath))
        {
            return sourcePath;
        }

        var parent = Path.GetDirectoryName(sourcePath);
        return parent is not null && Directory.Exists(parent) ? parent : null;
    }

    internal static IReadOnlyList<string> LegacyArtworkCandidates(
        string kindCode,
        string role,
        string sourceFolder,
        int? seasonNumber)
    {
        var candidates = new List<string>();

        void AddInFolder(string folder, params string[] names)
        {
            foreach (var name in names)
            {
                candidates.Add(Path.Combine(folder, name));
            }
        }

        if (string.Equals(role, "logo", StringComparison.OrdinalIgnoreCase))
        {
            AddInFolder(sourceFolder, "clearlogo.png", "logo.png");
        }
        else if (string.Equals(role, "backdrop", StringComparison.OrdinalIgnoreCase))
        {
            AddInFolder(sourceFolder, "banner.jpg", "fanart.jpg", "landscape.jpg", "backdrop.jpg");
        }
        else if (string.Equals(role, "poster", StringComparison.OrdinalIgnoreCase))
        {
            if (string.Equals(kindCode, VideoSeasonKind, StringComparison.OrdinalIgnoreCase) && seasonNumber is { } number)
            {
                var parent = Directory.GetParent(sourceFolder)?.FullName;
                if (parent is not null)
                {
                    AddInFolder(
                        parent,
                        $"season{number:D2}-poster.jpg",
                        $"season{number}-poster.jpg",
                        $"season{number:D2}.jpg",
                        $"season{number}.jpg");
                }

                AddInFolder(sourceFolder, "poster.jpg", "season-poster.jpg", "folder.jpg");
            }
            else if (string.Equals(kindCode, VideoSeriesKind, StringComparison.OrdinalIgnoreCase))
            {
                AddInFolder(sourceFolder, "poster.jpg", "cover.jpg", "folder.jpg");
            }
        }

        return candidates;
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

    /// <summary>
    /// Marks entity files whose path contains the v1 <c>-custom</c> suffix as
    /// <c>source = 'custom'</c> so scan jobs know not to overwrite them.
    /// </summary>
    private const string MarkCustomSourceSql = """
        UPDATE v2.entity_files
        SET source = 'custom'
        WHERE source = 'scan'
          AND path LIKE '%-custom%'
        """;

    private const string MissingLegacyArtworkQuery = """
        SELECT entity.kind_code,
               artwork.role,
               artwork.path,
               COALESCE(source_file.path, source_folder.value) AS source_folder,
               season.season_number
        FROM v2.entity_files artwork
        JOIN v2.entities entity ON entity.id = artwork.entity_id
        LEFT JOIN v2.entity_files source_file
          ON source_file.entity_id = artwork.entity_id
         AND source_file.role = 'source'
        LEFT JOIN v2.entity_sources source_folder
          ON source_folder.entity_id = artwork.entity_id
         AND source_folder.code = 'folder'
        LEFT JOIN v2.video_season_details season ON season.entity_id = artwork.entity_id
        WHERE artwork.source = 'custom'
          AND artwork.role IN ('poster', 'backdrop', 'logo')
          AND artwork.path LIKE '/assets/%';
        """;

    private sealed record LegacyArtworkRow(
        string KindCode,
        string Role,
        string UrlPath,
        string? SourceFolder,
        int? SeasonNumber);
}

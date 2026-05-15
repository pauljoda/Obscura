using Microsoft.EntityFrameworkCore;
using Obscura.Application.Videos;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Persistence;

namespace Obscura.Infrastructure.Videos;

/// <summary>
/// EF-backed implementation that resolves source video files from the shared file capability table.
/// </summary>
public sealed class VideoSourceService : IVideoSourceService
{
    private static readonly ISet<string> BrowserNativeExtensions =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            ".mp4",
            ".webm",
            ".ogg",
            ".ogv",
            ".m4v"
        };

    private static readonly ISet<string> RequiresTranscodeExtensions =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            ".mkv",
            ".avi",
            ".wmv",
            ".flv",
            ".mov",
            ".ts",
            ".m2ts"
        };

    private readonly ObscuraDbContext _db;

    /// <summary>
    /// Creates a video source resolver over the v2 database context.
    /// </summary>
    /// <param name="db">Database context used to find video source file rows.</param>
    public VideoSourceService(ObscuraDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<VideoSourceFile?> GetSourceAsync(Guid id, CancellationToken cancellationToken)
    {
        var source = await (
            from entity in _db.Entities.AsNoTracking()
            join file in _db.EntityFiles.AsNoTracking() on entity.Id equals file.EntityId
            join technical in _db.EntityTechnical.AsNoTracking() on entity.Id equals technical.EntityId into technicalRows
            from technical in technicalRows.DefaultIfEmpty()
            where entity.Id == id &&
                entity.KindCode == EntityKindRegistry.Video.Code &&
                entity.DeletedAt == null &&
                file.Role == EntityFileRole.Source
            select new
            {
                File = file,
                Technical = technical
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (source is null || !File.Exists(source.File.Path))
        {
            return null;
        }

        var extension = Path.GetExtension(source.File.Path);
        var directPlayable =
            BrowserNativeExtensions.Contains(extension) ||
            !RequiresTranscodeExtensions.Contains(extension);

        return new VideoSourceFile(
            id,
            source.File.Path,
            source.File.MimeType ?? MimeForExtension(extension),
            directPlayable,
            source.Technical?.DurationSeconds,
            source.Technical?.Width,
            source.Technical?.Height);
    }

    private static string MimeForExtension(string extension)
    {
        return extension.ToLowerInvariant() switch
        {
            ".mp4" or ".m4v" => "video/mp4",
            ".webm" => "video/webm",
            ".ogg" or ".ogv" => "video/ogg",
            ".mov" => "video/quicktime",
            ".mkv" => "video/x-matroska",
            ".avi" => "video/x-msvideo",
            ".wmv" => "video/x-ms-wmv",
            ".flv" => "video/x-flv",
            ".ts" or ".m2ts" => "video/mp2t",
            _ => "application/octet-stream"
        };
    }
}

using Microsoft.EntityFrameworkCore;
using Obscura.Application.Videos;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Media.Processing;
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
    private readonly MediaProbeService? _mediaProbe;

    /// <summary>
    /// Creates a video source resolver over the v2 database context.
    /// </summary>
    /// <param name="db">Database context used to find video source file rows.</param>
    public VideoSourceService(ObscuraDbContext db, MediaProbeService? mediaProbe = null)
    {
        _db = db;
        _mediaProbe = mediaProbe;
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

        var mediaSource = await _db.MediaSources.AsNoTracking()
            .Where(row => row.EntityId == id && row.Path == source.File.Path)
            .OrderByDescending(row => row.UpdatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        List<VideoSourceStream> streams = mediaSource is null
            ? []
            : await _db.MediaStreams.AsNoTracking()
                .Where(row => row.MediaSourceId == mediaSource.Id)
                .OrderBy(row => row.StreamIndex)
                .Select(row => new VideoSourceStream(
                    row.StreamIndex,
                    row.Type,
                    row.Codec,
                    row.Language,
                    row.Title,
                    row.Width,
                    row.Height,
                    row.FrameRate,
                    row.BitRate,
                    row.SampleRate,
                    row.Channels,
                    row.IsDefault,
                    row.IsForced))
                .ToListAsync(cancellationToken);
        if (_mediaProbe is not null && streams.Count(stream =>
                stream.Type.Equals("Audio", StringComparison.OrdinalIgnoreCase)) <= 1)
        {
            var probed = await _mediaProbe.ProbeVideoAsync(source.File.Path, cancellationToken);
            if (probed?.Streams is { Count: > 0 })
            {
                streams = probed.Streams
                    .Select(stream => new VideoSourceStream(
                        stream.StreamIndex,
                        stream.Type,
                        stream.Codec,
                        stream.Language,
                        stream.Title,
                        stream.Width,
                        stream.Height,
                        stream.FrameRate,
                        stream.BitRate,
                        stream.SampleRate,
                        stream.Channels,
                        stream.IsDefault,
                        stream.IsForced))
                    .OrderBy(stream => stream.StreamIndex)
                    .ToList();
            }
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
            mediaSource?.DurationSeconds ?? source.Technical?.DurationSeconds,
            mediaSource?.Width ?? source.Technical?.Width,
            mediaSource?.Height ?? source.Technical?.Height,
            mediaSource?.Id,
            mediaSource?.Container ?? source.Technical?.Container,
            mediaSource?.BitRate ?? source.Technical?.BitRate,
            mediaSource?.VideoCodec ?? source.Technical?.Codec,
            mediaSource?.AudioCodec,
            mediaSource?.FrameRate ?? source.Technical?.FrameRate,
            source.Technical?.SampleRate,
            source.Technical?.Channels,
            streams);
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

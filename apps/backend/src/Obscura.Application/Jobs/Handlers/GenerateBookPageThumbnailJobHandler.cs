using System.IO.Compression;
using Microsoft.Extensions.Logging;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Generates a thumbnail for a comic book page entity by extracting the image from the
/// archive and scaling it via ffmpeg.
/// </summary>
public sealed class GenerateBookPageThumbnailJobHandler(
    ILogger<GenerateBookPageThumbnailJobHandler> logger,
    IMediaAssetGenerator assets,
    ILibraryScanPersistence persistence) : IJobHandler
{
    public JobType Type => JobType.GenerateBookPageThumbnail;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        var entityId = ParseEntityId(context.Job.TargetEntityId);
        if (entityId is null) return;

        var sourcePath = await persistence.GetSourceFilePathAsync(entityId.Value, cancellationToken);
        if (sourcePath is null)
        {
            logger.LogWarning("GenerateBookPageThumbnail: source path not found for {EntityId}", entityId);
            return;
        }

        await context.ReportProgressAsync(20, "Extracting page", cancellationToken);

        var parts = sourcePath.Split("::", 2, StringSplitOptions.None);
        if (parts.Length != 2)
        {
            logger.LogWarning("GenerateBookPageThumbnail: invalid source path format {Path}", sourcePath);
            return;
        }

        var archivePath = parts[0];
        var memberPath = parts[1];

        if (!File.Exists(archivePath))
        {
            logger.LogWarning("GenerateBookPageThumbnail: archive not found {Path}", archivePath);
            return;
        }

        var tempPath = Path.Combine(Path.GetTempPath(), $"obscura-page-{entityId.Value}{Path.GetExtension(memberPath)}");
        try
        {
            if (!ExtractZipMember(archivePath, memberPath, tempPath))
            {
                logger.LogWarning("GenerateBookPageThumbnail: failed to extract {Member} from {Archive}", memberPath, archivePath);
                return;
            }

            await context.ReportProgressAsync(60, "Generating thumbnail", cancellationToken);

            var thumbPath = assets.BookPageThumbnailPath(entityId.Value);
            var success = await assets.GenerateImageThumbnailAsync(tempPath, thumbPath, 640, 3, cancellationToken);

            if (success)
            {
                var size = new FileInfo(thumbPath).Length;
                await persistence.UpsertEntityFileAsync(entityId.Value, "thumbnail", thumbPath, "image/jpeg", size, cancellationToken);
                logger.LogInformation("GenerateBookPageThumbnail: created thumbnail for {Label}", context.Job.TargetLabel);
            }
        }
        finally
        {
            try { File.Delete(tempPath); } catch { }
        }

        await context.ReportProgressAsync(100, "Thumbnail complete", cancellationToken);
    }

    private static bool ExtractZipMember(string archivePath, string memberPath, string outputPath)
    {
        try
        {
            using var archive = ZipFile.OpenRead(archivePath);
            var entry = archive.GetEntry(memberPath);
            if (entry is null) return false;

            Directory.CreateDirectory(Path.GetDirectoryName(outputPath)!);
            entry.ExtractToFile(outputPath, overwrite: true);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static Guid? ParseEntityId(string? value) =>
        Guid.TryParse(value, out var id) ? id : null;
}

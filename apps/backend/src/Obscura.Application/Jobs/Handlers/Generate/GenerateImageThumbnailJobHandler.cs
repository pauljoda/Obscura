using Obscura.Application.Jobs.Handlers;
using Microsoft.Extensions.Logging;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers.Generate;

/// <summary>
/// Generates a thumbnail for an image entity by scaling it to 640px width via ffmpeg.
/// </summary>
public sealed class GenerateImageThumbnailJobHandler(
    ILogger<GenerateImageThumbnailJobHandler> logger,
    IMediaAssetGenerator assets,
    ILibraryScanPersistence persistence) : EntityFileJobHandler(logger, persistence) {
    public override JobType Type => JobType.GenerateImageThumbnail;

    protected override async Task ExecuteAsync(
        JobContext context, Guid entityId, string filePath, CancellationToken cancellationToken) {
        await context.ReportProgressAsync(20, "Generating thumbnail", cancellationToken);

        var thumbPath = assets.ImageThumbnailPath(entityId);
        var success = await assets.GenerateImageThumbnailAsync(filePath, thumbPath, 640, 3, cancellationToken);

        if (success) {
            var size = new FileInfo(thumbPath).Length;
            await Persistence.UpsertEntityFileAsync(entityId, EntityFileRole.Thumbnail, assets.ImageThumbnailUrl(entityId), "image/jpeg", size, cancellationToken);
            logger.LogInformation("GenerateImageThumbnail: created thumbnail for {Label}", context.Job.TargetLabel);
        } else {
            logger.LogWarning("GenerateImageThumbnail: failed for {Label}", context.Job.TargetLabel);
        }

        await context.ReportProgressAsync(100, "Thumbnail complete", cancellationToken);
    }
}

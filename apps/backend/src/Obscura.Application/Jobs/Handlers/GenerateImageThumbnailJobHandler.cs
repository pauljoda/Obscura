using Microsoft.Extensions.Logging;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Generates a thumbnail for an image entity by scaling it to 640px width via ffmpeg.
/// </summary>
public sealed class GenerateImageThumbnailJobHandler(
    ILogger<GenerateImageThumbnailJobHandler> logger,
    IMediaAssetGenerator assets,
    ILibraryScanPersistence persistence) : IJobHandler
{
    public JobType Type => JobType.GenerateImageThumbnail;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        var entityId = ParseEntityId(context.Job.TargetEntityId);
        if (entityId is null) return;

        var filePath = await persistence.GetSourceFilePathAsync(entityId.Value, cancellationToken);
        if (filePath is null || !File.Exists(filePath))
        {
            logger.LogWarning("GenerateImageThumbnail: source file not found for {EntityId}", entityId);
            return;
        }

        await context.ReportProgressAsync(20, "Generating thumbnail", cancellationToken);

        var thumbPath = assets.ImageThumbnailPath(entityId.Value);
        var success = await assets.GenerateImageThumbnailAsync(filePath, thumbPath, 640, 3, cancellationToken);

        if (success)
        {
            var size = new FileInfo(thumbPath).Length;
            await persistence.UpsertEntityFileAsync(entityId.Value, "thumbnail", thumbPath, "image/jpeg", size, cancellationToken);
            logger.LogInformation("GenerateImageThumbnail: created thumbnail for {Label}", context.Job.TargetLabel);
        }
        else
        {
            logger.LogWarning("GenerateImageThumbnail: failed for {Label}", context.Job.TargetLabel);
        }

        await context.ReportProgressAsync(100, "Thumbnail complete", cancellationToken);
    }

    private static Guid? ParseEntityId(string? value) =>
        Guid.TryParse(value, out var id) ? id : null;
}

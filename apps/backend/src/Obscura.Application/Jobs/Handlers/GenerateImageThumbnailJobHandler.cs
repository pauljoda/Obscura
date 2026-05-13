using Microsoft.Extensions.Logging;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Generates thumbnails and lightweight previews for image entities.
/// </summary>
public sealed class GenerateImageThumbnailJobHandler(ILogger<GenerateImageThumbnailJobHandler> logger) : IJobHandler
{
    public JobType Type => JobType.GenerateImageThumbnail;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        logger.LogInformation("GenerateImageThumbnail stub: {TargetLabel}", context.Job.TargetLabel);
        await context.ReportProgressAsync(100, "Stub complete", cancellationToken);
    }
}

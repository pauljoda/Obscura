using Microsoft.Extensions.Logging;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Generates thumbnails for comic book page entities.
/// </summary>
public sealed class GenerateBookPageThumbnailJobHandler(ILogger<GenerateBookPageThumbnailJobHandler> logger) : IJobHandler
{
    public JobType Type => JobType.GenerateBookPageThumbnail;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        logger.LogInformation("GenerateBookPageThumbnail stub: {TargetLabel}", context.Job.TargetLabel);
        await context.ReportProgressAsync(100, "Stub complete", cancellationToken);
    }
}

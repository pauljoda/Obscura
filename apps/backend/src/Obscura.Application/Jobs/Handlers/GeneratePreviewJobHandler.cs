using Microsoft.Extensions.Logging;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Builds video thumbnails, preview clips, and trickplay sprites via ffmpeg.
/// </summary>
public sealed class GeneratePreviewJobHandler(ILogger<GeneratePreviewJobHandler> logger) : IJobHandler
{
    public JobType Type => JobType.GeneratePreview;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        logger.LogInformation("GeneratePreview stub: {TargetLabel}", context.Job.TargetLabel);
        await context.ReportProgressAsync(100, "Stub complete", cancellationToken);
    }
}

using Microsoft.Extensions.Logging;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Extracts technical metadata from a video file via ffprobe.
/// </summary>
public sealed class ProbeVideoJobHandler(ILogger<ProbeVideoJobHandler> logger) : IJobHandler
{
    public JobType Type => JobType.ProbeVideo;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        logger.LogInformation("ProbeVideo stub: {TargetLabel}", context.Job.TargetLabel);
        await context.ReportProgressAsync(100, "Stub complete", cancellationToken);
    }
}

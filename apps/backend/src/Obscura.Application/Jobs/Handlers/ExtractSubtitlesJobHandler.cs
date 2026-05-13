using Microsoft.Extensions.Logging;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Extracts embedded subtitle tracks from video files as WebVTT.
/// </summary>
public sealed class ExtractSubtitlesJobHandler(ILogger<ExtractSubtitlesJobHandler> logger) : IJobHandler
{
    public JobType Type => JobType.ExtractSubtitles;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        logger.LogInformation("ExtractSubtitles stub: {TargetLabel}", context.Job.TargetLabel);
        await context.ReportProgressAsync(100, "Stub complete", cancellationToken);
    }
}

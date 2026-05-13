using Microsoft.Extensions.Logging;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Computes MD5, oshash, and optional perceptual hash for a video entity.
/// </summary>
public sealed class FingerprintVideoJobHandler(ILogger<FingerprintVideoJobHandler> logger) : IJobHandler
{
    public JobType Type => JobType.FingerprintVideo;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        logger.LogInformation("FingerprintVideo stub: {TargetLabel}", context.Job.TargetLabel);
        await context.ReportProgressAsync(100, "Stub complete", cancellationToken);
    }
}

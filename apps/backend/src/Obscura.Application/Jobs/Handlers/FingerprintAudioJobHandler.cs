using Microsoft.Extensions.Logging;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Computes MD5 and oshash fingerprints for an audio track entity.
/// </summary>
public sealed class FingerprintAudioJobHandler(ILogger<FingerprintAudioJobHandler> logger) : IJobHandler
{
    public JobType Type => JobType.FingerprintAudio;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        logger.LogInformation("FingerprintAudio stub: {TargetLabel}", context.Job.TargetLabel);
        await context.ReportProgressAsync(100, "Stub complete", cancellationToken);
    }
}

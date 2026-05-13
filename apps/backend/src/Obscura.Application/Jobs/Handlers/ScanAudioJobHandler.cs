using Microsoft.Extensions.Logging;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Discovers audio tracks in a configured library root.
/// </summary>
public sealed class ScanAudioJobHandler(ILogger<ScanAudioJobHandler> logger) : IJobHandler
{
    public JobType Type => JobType.ScanAudio;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        logger.LogInformation("ScanAudio stub: {TargetLabel}", context.Job.TargetLabel);
        await context.ReportProgressAsync(100, "Stub complete", cancellationToken);
    }
}

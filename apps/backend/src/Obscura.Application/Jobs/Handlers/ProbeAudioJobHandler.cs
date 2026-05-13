using Microsoft.Extensions.Logging;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Extracts technical metadata and embedded tags from an audio file.
/// </summary>
public sealed class ProbeAudioJobHandler(ILogger<ProbeAudioJobHandler> logger) : IJobHandler
{
    public JobType Type => JobType.ProbeAudio;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        logger.LogInformation("ProbeAudio stub: {TargetLabel}", context.Job.TargetLabel);
        await context.ReportProgressAsync(100, "Stub complete", cancellationToken);
    }
}

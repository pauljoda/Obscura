using Microsoft.Extensions.Logging;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Discovers video files in a configured library root and enqueues downstream probe jobs.
/// </summary>
public sealed class ScanLibraryJobHandler(ILogger<ScanLibraryJobHandler> logger) : IJobHandler
{
    public JobType Type => JobType.ScanLibrary;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        logger.LogInformation("ScanLibrary stub: {TargetLabel} ({Payload})", context.Job.TargetLabel, context.Job.PayloadJson);
        await context.ReportProgressAsync(100, "Stub complete", cancellationToken);
    }
}

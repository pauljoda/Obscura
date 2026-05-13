using Microsoft.Extensions.Logging;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Discovers comic books in a configured library root.
/// </summary>
public sealed class ScanBookJobHandler(ILogger<ScanBookJobHandler> logger) : IJobHandler
{
    public JobType Type => JobType.ScanBook;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        logger.LogInformation("ScanBook stub: {TargetLabel}", context.Job.TargetLabel);
        await context.ReportProgressAsync(100, "Stub complete", cancellationToken);
    }
}

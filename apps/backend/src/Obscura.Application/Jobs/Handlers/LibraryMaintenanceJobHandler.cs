using Microsoft.Extensions.Logging;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Moves video-derived assets between cache and media-adjacent storage.
/// </summary>
public sealed class LibraryMaintenanceJobHandler(ILogger<LibraryMaintenanceJobHandler> logger) : IJobHandler
{
    public JobType Type => JobType.LibraryMaintenance;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        logger.LogInformation("LibraryMaintenance stub: {TargetLabel}", context.Job.TargetLabel);
        await context.ReportProgressAsync(100, "Stub complete", cancellationToken);
    }
}

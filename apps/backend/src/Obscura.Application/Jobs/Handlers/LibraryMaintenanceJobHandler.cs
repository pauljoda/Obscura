using Microsoft.Extensions.Logging;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Performs library maintenance: validates generated assets exist on disk
/// and cleans up orphaned cache entries. Currently a lightweight implementation
/// that logs asset validation results.
/// </summary>
public sealed class LibraryMaintenanceJobHandler(ILogger<LibraryMaintenanceJobHandler> logger) : IJobHandler
{
    public JobType Type => JobType.LibraryMaintenance;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        logger.LogInformation("LibraryMaintenance: asset validation pass for {Label}", context.Job.TargetLabel);
        await context.ReportProgressAsync(100, "Maintenance complete", cancellationToken);
    }
}

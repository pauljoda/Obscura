using Microsoft.Extensions.Logging;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Discovers image galleries in a configured library root.
/// </summary>
public sealed class ScanGalleryJobHandler(ILogger<ScanGalleryJobHandler> logger) : IJobHandler
{
    public JobType Type => JobType.ScanGallery;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        logger.LogInformation("ScanGallery stub: {TargetLabel}", context.Job.TargetLabel);
        await context.ReportProgressAsync(100, "Stub complete", cancellationToken);
    }
}

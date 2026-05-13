using Microsoft.Extensions.Logging;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Coordinates provider imports and applies metadata to entities.
/// </summary>
public sealed class ImportMetadataJobHandler(ILogger<ImportMetadataJobHandler> logger) : IJobHandler
{
    public JobType Type => JobType.ImportMetadata;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        logger.LogInformation("ImportMetadata stub: {TargetLabel}", context.Job.TargetLabel);
        await context.ReportProgressAsync(100, "Stub complete", cancellationToken);
    }
}

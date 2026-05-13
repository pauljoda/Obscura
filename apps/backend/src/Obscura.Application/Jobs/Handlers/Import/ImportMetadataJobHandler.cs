using Obscura.Application.Jobs;
using Microsoft.Extensions.Logging;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers.Import;

/// <summary>
/// Coordinates provider-driven metadata imports for entities. Currently a placeholder
/// until the provider/identify system is migrated to the .NET backend.
/// </summary>
public sealed class ImportMetadataJobHandler(ILogger<ImportMetadataJobHandler> logger) : IJobHandler
{
    public JobType Type => JobType.ImportMetadata;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        logger.LogInformation("ImportMetadata: provider imports not yet migrated for {Label}", context.Job.TargetLabel);
        await context.ReportProgressAsync(100, "Provider system pending migration", cancellationToken);
    }
}

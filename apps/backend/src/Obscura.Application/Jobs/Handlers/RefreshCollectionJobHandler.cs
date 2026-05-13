using Microsoft.Extensions.Logging;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Re-evaluates dynamic collection rules and updates membership. Currently a placeholder
/// until the collection rule engine is migrated to the .NET backend.
/// </summary>
public sealed class RefreshCollectionJobHandler(ILogger<RefreshCollectionJobHandler> logger) : IJobHandler
{
    public JobType Type => JobType.RefreshCollection;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        logger.LogInformation("RefreshCollection: collection engine not yet migrated for {Label}", context.Job.TargetLabel);
        await context.ReportProgressAsync(100, "Collection engine pending migration", cancellationToken);
    }
}

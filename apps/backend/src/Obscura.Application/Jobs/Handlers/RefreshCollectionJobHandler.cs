using Microsoft.Extensions.Logging;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Re-evaluates dynamic collection rules and updates membership.
/// </summary>
public sealed class RefreshCollectionJobHandler(ILogger<RefreshCollectionJobHandler> logger) : IJobHandler
{
    public JobType Type => JobType.RefreshCollection;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        logger.LogInformation("RefreshCollection stub: {TargetLabel}", context.Job.TargetLabel);
        await context.ReportProgressAsync(100, "Stub complete", cancellationToken);
    }
}

using Obscura.Contracts.Jobs;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs;

/// <summary>
/// Job handler used to verify that the durable queue can claim, run, and complete a job.
/// </summary>
public sealed class NoOpJobHandler : IJobHandler
{
    /// <inheritdoc />
    public JobType Type => JobType.Noop;

    /// <inheritdoc />
    public Task HandleAsync(JobRun job, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}

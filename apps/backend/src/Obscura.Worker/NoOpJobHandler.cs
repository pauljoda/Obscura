using Obscura.Contracts.Jobs;
using Obscura.Domain.Entities;

namespace Obscura.Worker;

public sealed class NoOpJobHandler : IJobHandler
{
    public JobType Type => JobType.Noop;

    public Task HandleAsync(JobRun job, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}

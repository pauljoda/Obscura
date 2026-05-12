using Obscura.Contracts.Jobs;

namespace Obscura.Worker;

public sealed class NoOpJobHandler : IJobHandler
{
    public string Type => "noop";

    public Task HandleAsync(JobRun job, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}

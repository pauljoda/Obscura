using Obscura.Contracts.Jobs;

namespace Obscura.Worker;

public sealed class NoOpJobHandler : IJobHandler
{
    public string Type => "noop";

    public Task HandleAsync(JobRunDto job, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}

using Obscura.Contracts.Jobs;

namespace Obscura.Worker;

public interface IJobHandler
{
    string Type { get; }

    Task HandleAsync(JobRunDto job, CancellationToken cancellationToken);
}

using Obscura.Contracts.Jobs;
using Obscura.Domain.Entities;

namespace Obscura.Worker;

public interface IJobHandler
{
    JobType Type { get; }

    Task HandleAsync(JobRun job, CancellationToken cancellationToken);
}

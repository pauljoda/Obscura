using Obscura.Contracts.Jobs;
using Obscura.Domain.Entities;

namespace Obscura.Infrastructure.Queue;

public interface IJobQueueService
{
    Task<IReadOnlyList<JobRun>> ListAsync(CancellationToken cancellationToken);

    Task<JobRun> EnqueueAsync(JobType type, CancellationToken cancellationToken);

    Task<JobRun?> ClaimNextAsync(string workerId, CancellationToken cancellationToken);

    Task CompleteAsync(Guid id, string? message, CancellationToken cancellationToken);

    Task FailAsync(Guid id, string message, TimeSpan retryDelay, CancellationToken cancellationToken);
}

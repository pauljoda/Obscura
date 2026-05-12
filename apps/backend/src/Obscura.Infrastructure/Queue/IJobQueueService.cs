using Obscura.Contracts.Jobs;

namespace Obscura.Infrastructure.Queue;

public interface IJobQueueService
{
    Task<IReadOnlyList<JobRunDto>> ListAsync(CancellationToken cancellationToken);

    Task<JobRunDto> EnqueueAsync(string type, CancellationToken cancellationToken);

    Task<JobRunDto?> ClaimNextAsync(string workerId, CancellationToken cancellationToken);

    Task CompleteAsync(Guid id, string? message, CancellationToken cancellationToken);

    Task FailAsync(Guid id, string message, TimeSpan retryDelay, CancellationToken cancellationToken);
}

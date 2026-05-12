using Obscura.Contracts.Jobs;

namespace Obscura.Infrastructure.Queue;

public interface IJobQueueService
{
    Task<IReadOnlyList<JobRunDto>> ListAsync(CancellationToken cancellationToken);

    Task<JobRunDto> EnqueueAsync(string type, CancellationToken cancellationToken);
}

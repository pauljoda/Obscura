using Obscura.Contracts.Jobs;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs;

/// <summary>
/// Application port for durable background job queue operations.
/// </summary>
public interface IJobQueueService
{
    /// <summary>
    /// Lists recent background job runs for operational surfaces.
    /// </summary>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Recent job runs ordered newest first.</returns>
    Task<IReadOnlyList<JobRun>> ListAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Enqueues a new background job run.
    /// </summary>
    /// <param name="type">Typed job kind to run.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>The persisted job run.</returns>
    Task<JobRun> EnqueueAsync(JobType type, CancellationToken cancellationToken);

    /// <summary>
    /// Claims the next available queued job for one worker.
    /// </summary>
    /// <param name="workerId">Stable worker identifier used for the queue lock.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>The claimed job run, or null when no jobs are available.</returns>
    Task<JobRun?> ClaimNextAsync(string workerId, CancellationToken cancellationToken);

    /// <summary>
    /// Marks a running job complete.
    /// </summary>
    /// <param name="id">Job run identifier.</param>
    /// <param name="message">Optional completion message.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    Task CompleteAsync(Guid id, string? message, CancellationToken cancellationToken);

    /// <summary>
    /// Marks a running job failed and schedules a retry when attempts remain.
    /// </summary>
    /// <param name="id">Job run identifier.</param>
    /// <param name="message">Failure message stored on the job run.</param>
    /// <param name="retryDelay">Delay before the job becomes available again.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    Task FailAsync(Guid id, string message, TimeSpan retryDelay, CancellationToken cancellationToken);
}

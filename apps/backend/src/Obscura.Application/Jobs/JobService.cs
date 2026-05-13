using Obscura.Contracts.Jobs;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs;

/// <summary>
/// Application use-case service for listing and creating background jobs.
/// </summary>
public sealed class JobService
{
    private readonly IJobQueueService _queue;

    /// <summary>
    /// Creates a job service over the durable queue port.
    /// </summary>
    /// <param name="queue">Queue port implemented by infrastructure persistence.</param>
    public JobService(IJobQueueService queue)
    {
        _queue = queue;
    }

    /// <summary>
    /// Lists recent job runs for the operations dashboard.
    /// </summary>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>API-ready job list response.</returns>
    public async Task<JobListResponse> ListAsync(CancellationToken cancellationToken) =>
        new((await _queue.ListAsync(cancellationToken)).Select(ToContract).ToArray());

    /// <summary>
    /// Creates a job from a typed queue operation.
    /// </summary>
    /// <param name="type">Typed job operation supplied by the API boundary.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>API-ready create response for the queued job.</returns>
    public async Task<JobCreateResponse> CreateAsync(JobType type, CancellationToken cancellationToken)
    {
        var job = await _queue.EnqueueAsync(type, cancellationToken);
        return new JobCreateResponse(ToContract(job));
    }

    /// <summary>
    /// Cancels queued or running jobs, optionally scoped to one typed operation.
    /// </summary>
    /// <param name="type">Optional job type scope.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Count of jobs marked cancelled.</returns>
    public async Task<JobCancelResponse> CancelAsync(JobType? type, CancellationToken cancellationToken)
    {
        var cancelled = await _queue.CancelAsync(type, cancellationToken);
        return new JobCancelResponse(cancelled);
    }

    /// <summary>
    /// Cancels a single queued or running job by identifier.
    /// </summary>
    /// <param name="id">Job run identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Response with a one-or-zero cancellation count.</returns>
    public async Task<JobCancelResponse> CancelRunAsync(Guid id, CancellationToken cancellationToken)
    {
        var cancelled = await _queue.CancelRunAsync(id, cancellationToken);
        return new JobCancelResponse(cancelled ? 1 : 0);
    }

    /// <summary>
    /// Clears failed jobs from the active failure list, optionally scoped to one typed operation.
    /// </summary>
    /// <param name="type">Optional job type scope.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Count of failed jobs cleared.</returns>
    public async Task<JobFailureClearResponse> ClearFailuresAsync(
        JobType? type,
        CancellationToken cancellationToken)
    {
        var cleared = await _queue.ClearFailuresAsync(type, cancellationToken);
        return new JobFailureClearResponse(cleared);
    }

    private static JobRun ToContract(JobRunSnapshot job) =>
        new(
            job.Id,
            job.Type.ToCode(),
            job.Status.ToCode(),
            job.Progress,
            job.Message,
            job.CreatedAt,
            job.StartedAt,
            job.FinishedAt);
}

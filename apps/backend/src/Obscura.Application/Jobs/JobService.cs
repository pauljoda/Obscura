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
    /// <returns>Application job list result.</returns>
    public async Task<JobListResult> ListAsync(CancellationToken cancellationToken)
    {
        var items = (await _queue.ListAsync(cancellationToken)).Select(ToResult).ToArray();
        var counts = (await _queue.GetQueueCountsAsync(cancellationToken))
            .Select(c => new JobQueueCountResult(c.TypeCode, c.StatusCode, c.Count))
            .ToArray();
        return new JobListResult(items, counts);
    }

    /// <summary>
    /// Creates a job from a typed queue operation.
    /// </summary>
    /// <param name="type">Typed job operation supplied by the API boundary.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Application create result for the queued job.</returns>
    public async Task<JobCreateResult> CreateAsync(JobType type, CancellationToken cancellationToken)
    {
        var job = await _queue.EnqueueAsync(type, cancellationToken);
        return new JobCreateResult(ToResult(job));
    }

    /// <summary>
    /// Cancels queued or running jobs, optionally scoped to one typed operation.
    /// </summary>
    /// <param name="type">Optional job type scope.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Count of jobs marked cancelled.</returns>
    public async Task<JobCancelResult> CancelAsync(JobType? type, CancellationToken cancellationToken)
    {
        var cancelled = await _queue.CancelAsync(type, cancellationToken);
        return new JobCancelResult(cancelled);
    }

    /// <summary>
    /// Cancels a single queued or running job by identifier.
    /// </summary>
    /// <param name="id">Job run identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Response with a one-or-zero cancellation count.</returns>
    public async Task<JobCancelResult> CancelRunAsync(Guid id, CancellationToken cancellationToken)
    {
        var cancelled = await _queue.CancelRunAsync(id, cancellationToken);
        return new JobCancelResult(cancelled ? 1 : 0);
    }

    /// <summary>
    /// Clears failed jobs from the active failure list, optionally scoped to one typed operation.
    /// </summary>
    /// <param name="type">Optional job type scope.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Count of failed jobs cleared.</returns>
    public async Task<JobFailureClearResult> ClearFailuresAsync(
        JobType? type,
        CancellationToken cancellationToken)
    {
        var cleared = await _queue.ClearFailuresAsync(type, cancellationToken);
        return new JobFailureClearResult(cleared);
    }

    private static JobRunResult ToResult(JobRunSnapshot job) =>
        new(
            job.Id,
            job.Type.ToCode(),
            job.Status.ToCode(),
            job.Progress,
            job.Message,
            job.TargetEntityKind,
            job.TargetEntityId,
            job.TargetLabel,
            job.CreatedAt,
            job.StartedAt,
            job.FinishedAt);
}

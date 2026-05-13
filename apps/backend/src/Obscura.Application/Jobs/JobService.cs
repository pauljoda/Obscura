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

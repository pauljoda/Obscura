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
        new(await _queue.ListAsync(cancellationToken));

    /// <summary>
    /// Creates a job from the route job-type code.
    /// </summary>
    /// <param name="typeCode">Stable job type code supplied by an API caller.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>A create result containing either the queued job response or an unknown-type error.</returns>
    public async Task<CreateJobResult> CreateAsync(string typeCode, CancellationToken cancellationToken)
    {
        if (!typeCode.TryDecodeAs<JobType>(out var jobType))
        {
            return CreateJobResult.UnknownType(typeCode);
        }

        var job = await _queue.EnqueueAsync(jobType, cancellationToken);
        return CreateJobResult.Created(new JobCreateResponse(job));
    }
}

/// <summary>
/// Application result for creating a background job from an external type code.
/// </summary>
/// <param name="Response">Created job response when the type code is valid.</param>
/// <param name="ErrorMessage">User-facing error when the type code is invalid.</param>
public sealed record CreateJobResult(JobCreateResponse? Response, string? ErrorMessage)
{
    /// <summary>
    /// Creates a successful job-create result.
    /// </summary>
    /// <param name="response">API-ready created job response.</param>
    /// <returns>Successful create result.</returns>
    public static CreateJobResult Created(JobCreateResponse response) => new(response, null);

    /// <summary>
    /// Creates an unknown-type job-create result.
    /// </summary>
    /// <param name="typeCode">Unsupported job type code.</param>
    /// <returns>Failed create result with a user-facing message.</returns>
    public static CreateJobResult UnknownType(string typeCode) =>
        new(null, $"'{typeCode}' is not a supported Obscura job type.");
}

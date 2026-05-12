namespace Obscura.Contracts.Jobs;

/// <summary>
/// API-facing operation row used by the jobs dashboard.
/// </summary>
/// <param name="Id">Job run identifier.</param>
/// <param name="Type">Queue type or operation code.</param>
/// <param name="Status">Current job status.</param>
/// <param name="Progress">Progress percentage from 0 through 100.</param>
/// <param name="Message">Optional status, completion, or failure message.</param>
/// <param name="CreatedAt">Time the job was created.</param>
/// <param name="StartedAt">Time the job started, when claimed.</param>
/// <param name="FinishedAt">Time the job finished, when complete or failed.</param>
public sealed record JobRun(
    Guid Id,
    string Type,
    string Status,
    int Progress,
    string? Message,
    DateTimeOffset CreatedAt,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt);

/// <summary>
/// API response containing job runs for the operations dashboard.
/// </summary>
/// <param name="Items">Job runs ordered by the API.</param>
public sealed record JobListResponse(IReadOnlyList<JobRun> Items);

/// <summary>
/// API response returned after creating a new job run.
/// </summary>
/// <param name="Job">The created job run.</param>
public sealed record JobCreateResponse(JobRun Job);

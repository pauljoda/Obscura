namespace Obscura.Application.Jobs;

/// <summary>
/// Application result for one background job run as shown on the operations dashboard.
/// </summary>
public sealed record JobRunResult(
    Guid Id,
    string Type,
    string Status,
    int Progress,
    string? Message,
    string? TargetKind,
    string? TargetId,
    string? TargetLabel,
    DateTimeOffset CreatedAt,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt);

/// <summary>
/// Application aggregate count of background jobs sharing a type and status.
/// </summary>
public sealed record JobQueueCountResult(string Type, string Status, int Count);

/// <summary>
/// Application result for listing operations-dashboard jobs.
/// </summary>
public sealed record JobListResult(
    IReadOnlyList<JobRunResult> Items,
    IReadOnlyList<JobQueueCountResult> Counts);

/// <summary>
/// Application result returned after queuing a background job.
/// </summary>
public sealed record JobCreateResult(JobRunResult Job);

/// <summary>
/// Application result returned after cancelling queued or running jobs.
/// </summary>
public sealed record JobCancelResult(int Cancelled);

/// <summary>
/// Application result returned after clearing active job failures.
/// </summary>
public sealed record JobFailureClearResult(int Cleared);

/// <summary>
/// Application result returned after a bulk maintenance queue operation.
/// </summary>
public sealed record BulkJobResult(int Enqueued, int Skipped);

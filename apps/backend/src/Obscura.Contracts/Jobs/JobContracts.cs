namespace Obscura.Contracts.Jobs;

public sealed record JobRun(
    Guid Id,
    string Type,
    string Status,
    int Progress,
    string? Message,
    DateTimeOffset CreatedAt,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt);

public sealed record JobListResponse(IReadOnlyList<JobRun> Items);

public sealed record JobCreateResponse(JobRun Job);

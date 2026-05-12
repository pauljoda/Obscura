namespace Obscura.Contracts.Jobs;

public sealed record JobRunDto(
    Guid Id,
    string Type,
    string Status,
    int Progress,
    string? Message,
    DateTimeOffset CreatedAt,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt);

public sealed record JobListResponseDto(IReadOnlyList<JobRunDto> Items);

public sealed record JobCreateResponseDto(JobRunDto Job);

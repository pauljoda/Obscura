using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs;

/// <summary>
/// Application-layer view of a durable job run with typed queue classification values.
/// </summary>
/// <param name="Id">Job run identifier.</param>
/// <param name="Type">Typed operation that the worker should execute.</param>
/// <param name="Status">Typed lifecycle status for dashboard and worker decisions.</param>
/// <param name="Progress">Progress percentage from 0 through 100.</param>
/// <param name="Message">Optional status, completion, or failure message.</param>
/// <param name="CreatedAt">Time the job was created.</param>
/// <param name="StartedAt">Time the job started, when claimed.</param>
/// <param name="FinishedAt">Time the job finished, when complete or failed.</param>
public sealed record JobRunSnapshot(
    Guid Id,
    JobType Type,
    JobRunStatus Status,
    int Progress,
    string? Message,
    DateTimeOffset CreatedAt,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt);

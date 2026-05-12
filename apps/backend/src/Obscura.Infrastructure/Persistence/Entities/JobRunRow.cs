namespace Obscura.Infrastructure.Persistence.Entities;

public sealed class JobRunRow
{
    public Guid Id { get; set; }

    public string Type { get; set; } = string.Empty;

    public string Status { get; set; } = "queued";

    public string PayloadJson { get; set; } = "{}";

    public int Priority { get; set; }

    public int Attempts { get; set; }

    public int MaxAttempts { get; set; } = 3;

    public int Progress { get; set; }

    public string? Message { get; set; }

    public DateTimeOffset AvailableAt { get; set; }

    public DateTimeOffset? LockedAt { get; set; }

    public string? LockedBy { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? StartedAt { get; set; }

    public DateTimeOffset? FinishedAt { get; set; }
}

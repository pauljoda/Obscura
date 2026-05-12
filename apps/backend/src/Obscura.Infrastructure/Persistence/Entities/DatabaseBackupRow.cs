namespace Obscura.Infrastructure.Persistence.Entities;

public sealed class DatabaseBackupRow
{
    public Guid Id { get; set; }

    public string BackupPath { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string? Error { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? CompletedAt { get; set; }
}

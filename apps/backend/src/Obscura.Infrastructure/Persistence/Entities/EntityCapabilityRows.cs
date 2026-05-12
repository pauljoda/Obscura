namespace Obscura.Infrastructure.Persistence.Entities;

public sealed class EntityAliasRow
{
    public Guid Id { get; set; }
    public Guid EntityId { get; set; }
    public string Value { get; set; } = string.Empty;
    public string? AliasType { get; set; }
    public int SortOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class EntityPlaybackRow
{
    public Guid EntityId { get; set; }
    public int PlayCount { get; set; }
    public double PlayDurationSeconds { get; set; }
    public double ResumeSeconds { get; set; }
    public DateTimeOffset? LastPlayedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class EntityCounterRow
{
    public Guid EntityId { get; set; }
    public string Code { get; set; } = string.Empty;
    public int Value { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class EntityFileFingerprintRow
{
    public Guid Id { get; set; }
    public Guid EntityId { get; set; }
    public Guid? EntityFileId { get; set; }
    public string Algorithm { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
}

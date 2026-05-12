namespace Obscura.Infrastructure.Persistence.Entities;

public sealed class EntityFileRow
{
    public Guid Id { get; set; }

    public Guid EntityId { get; set; }

    public string Role { get; set; } = string.Empty;

    public string Path { get; set; } = string.Empty;

    public string? MimeType { get; set; }

    public long? SizeBytes { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}

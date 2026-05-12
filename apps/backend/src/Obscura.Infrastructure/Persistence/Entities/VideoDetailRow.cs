namespace Obscura.Infrastructure.Persistence.Entities;

public sealed class VideoDetailRow
{
    public Guid EntityId { get; set; }

    public string? Summary { get; set; }

    public long? DurationMs { get; set; }

    public int? Width { get; set; }

    public int? Height { get; set; }
}

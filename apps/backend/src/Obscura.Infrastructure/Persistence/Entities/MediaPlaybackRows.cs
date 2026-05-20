namespace Obscura.Infrastructure.Persistence.Entities;

public sealed class MediaSourceRow {
    public Guid Id { get; set; }
    public Guid EntityId { get; set; }
    public Guid? EntityFileId { get; set; }
    public string Path { get; set; } = string.Empty;
    public string Protocol { get; set; } = "File";
    public string? Container { get; set; }
    public string? Name { get; set; }
    public long? SizeBytes { get; set; }
    public double? DurationSeconds { get; set; }
    public int? BitRate { get; set; }
    public string? VideoCodec { get; set; }
    public string? AudioCodec { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public double? FrameRate { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class MediaStreamRow {
    public Guid Id { get; set; }
    public Guid MediaSourceId { get; set; }
    public Guid EntityId { get; set; }
    public int StreamIndex { get; set; }
    public string Type { get; set; } = string.Empty;
    public string? Codec { get; set; }
    public string? Language { get; set; }
    public string? Title { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public double? FrameRate { get; set; }
    public int? BitRate { get; set; }
    public int? SampleRate { get; set; }
    public int? Channels { get; set; }
    public bool IsDefault { get; set; }
    public bool IsForced { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class TrickplayInfoRow {
    public Guid EntityId { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public int TileWidth { get; set; }
    public int TileHeight { get; set; }
    public int ThumbnailCount { get; set; }
    public double IntervalSeconds { get; set; }
    public int Bandwidth { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

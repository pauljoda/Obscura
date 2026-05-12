namespace Obscura.Infrastructure.Persistence.Entities;

public sealed class VideoDetailRow
{
    public Guid EntityId { get; set; }

    public Guid? LibraryRootId { get; set; }

    public string? Summary { get; set; }

    public string? SortTitle { get; set; }

    public string? OriginalTitle { get; set; }

    public string? Tagline { get; set; }

    public string? ReleaseDate { get; set; }

    public string? ContentRating { get; set; }

    public long? DurationMs { get; set; }

    public int? Width { get; set; }

    public int? Height { get; set; }

    public double? FrameRate { get; set; }

    public int? BitRate { get; set; }

    public string? Codec { get; set; }

    public string? Container { get; set; }

    public DateTimeOffset? SubtitlesExtractedAt { get; set; }
}

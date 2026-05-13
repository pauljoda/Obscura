using Obscura.Domain.Entities;

namespace Obscura.Infrastructure.Persistence.Entities;

public sealed class VideoSeriesDetailRow
{
    public Guid EntityId { get; set; }
    public Guid? LibraryRootId { get; set; }
    public string? FolderPath { get; set; }
    public string? RelativePath { get; set; }
    public string? SortTitle { get; set; }
    public string? OriginalTitle { get; set; }
    public string? Overview { get; set; }
    public string? Tagline { get; set; }
    public string? Status { get; set; }
    public string? FirstAirDate { get; set; }
    public string? EndAirDate { get; set; }
    public string? ContentRating { get; set; }
    public VideoSeriesRenderingMode RenderingMode { get; set; } = VideoSeriesRenderingMode.Flat;
}

public sealed class VideoSeasonDetailRow
{
    public Guid EntityId { get; set; }
    public Guid SeriesEntityId { get; set; }
    public int SeasonNumber { get; set; }
    public string? FolderPath { get; set; }
    public string? Overview { get; set; }
    public string? AirDate { get; set; }
}

public sealed class GalleryDetailRow
{
    public Guid EntityId { get; set; }
    public string? Details { get; set; }
    public string? Date { get; set; }
    public GalleryType GalleryType { get; set; } = GalleryType.Virtual;
    public string? FolderPath { get; set; }
    public string? ZipFilePath { get; set; }
    public Guid? CoverImageEntityId { get; set; }
    public int ImageCount { get; set; }
}

public sealed class ImageDetailRow
{
    public Guid EntityId { get; set; }
    public string? Details { get; set; }
    public string? Date { get; set; }
    public string? FilePath { get; set; }
    public long? FileSizeBytes { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public string? Format { get; set; }
    public int SortOrder { get; set; }
}

public sealed class BookDetailRow
{
    public Guid EntityId { get; set; }
    public Guid? LibraryRootId { get; set; }
    public BookType BookType { get; set; } = BookType.Book;
    public string? SortTitle { get; set; }
    public string? Summary { get; set; }
    public string? Date { get; set; }
    public string? FolderPath { get; set; }
    public string? RelativePath { get; set; }
    public Guid? CoverPageEntityId { get; set; }
    public string? CoverImagePath { get; set; }
    public int PageCount { get; set; }
    public int ChapterCount { get; set; }
}

public sealed class BookVolumeDetailRow
{
    public Guid EntityId { get; set; }
    public Guid BookEntityId { get; set; }
    public int? VolumeNumber { get; set; }
    public string? FolderPath { get; set; }
    public string? RelativePath { get; set; }
    public string? CoverImagePath { get; set; }
}

public sealed class BookChapterDetailRow
{
    public Guid EntityId { get; set; }
    public Guid BookEntityId { get; set; }
    public Guid? VolumeEntityId { get; set; }
    public int ChapterNumber { get; set; }
    public string? ArchivePath { get; set; }
    public string? RelativePath { get; set; }
    public int PageCount { get; set; }
    public Guid? CoverPageEntityId { get; set; }
}

public sealed class BookPageDetailRow
{
    public Guid EntityId { get; set; }
    public Guid BookEntityId { get; set; }
    public Guid ChapterEntityId { get; set; }
    public string FilePath { get; set; } = string.Empty;
    public long? FileSizeBytes { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public string? Format { get; set; }
    public int SortOrder { get; set; }
}

public sealed class BookReadProgressRow
{
    public Guid BookEntityId { get; set; }
    public Guid? ChapterEntityId { get; set; }
    public int PageIndex { get; set; }
    public int PageCount { get; set; }
    public ReaderMode ReaderMode { get; set; } = ReaderMode.Paged;
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class AudioLibraryDetailRow
{
    public Guid EntityId { get; set; }
    public string? Details { get; set; }
    public string? Date { get; set; }
    public string? FolderPath { get; set; }
    public Guid? ParentLibraryEntityId { get; set; }
    public int TrackCount { get; set; }
}

public sealed class AudioTrackDetailRow
{
    public Guid EntityId { get; set; }
    public string? Details { get; set; }
    public string? Date { get; set; }
    public double? DurationSeconds { get; set; }
    public int? BitRate { get; set; }
    public int? SampleRate { get; set; }
    public int? Channels { get; set; }
    public string? Codec { get; set; }
    public string? Container { get; set; }
    public string? EmbeddedArtist { get; set; }
    public string? EmbeddedAlbum { get; set; }
    public int? TrackNumber { get; set; }
    public string? WaveformPath { get; set; }
}

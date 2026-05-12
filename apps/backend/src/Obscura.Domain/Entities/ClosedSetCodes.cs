namespace Obscura.Domain.Entities;

/// <summary>
/// Closed set of page-based media categories supported by the core book model.
/// </summary>
public enum BookType
{
    /// <summary>Default book-shaped item when no narrower category is known.</summary>
    Book,

    /// <summary>Sequential art or comic archive content.</summary>
    Comic,

    /// <summary>Manga content, usually read with manga-specific ordering or layout affordances.</summary>
    Manga,

    /// <summary>Long-form prose content.</summary>
    Novel
}

/// <summary>
/// Closed set of reader layouts supported by the book reading surface.
/// </summary>
public enum ReaderMode
{
    /// <summary>One page or spread at a time.</summary>
    Paged,

    /// <summary>Continuous vertical reading for long-strip comics and similar formats.</summary>
    Webtoon
}

/// <summary>
/// Closed set of gallery storage shapes known to Obscura.
/// </summary>
public enum GalleryType
{
    /// <summary>Gallery assembled from existing image entities or metadata without one source folder.</summary>
    Virtual,

    /// <summary>Gallery discovered from a filesystem folder.</summary>
    Folder,

    /// <summary>Gallery discovered from a zip or comic archive file.</summary>
    Zip
}

/// <summary>
/// Closed set of layouts for displaying a video series detail view.
/// </summary>
public enum VideoSeriesRenderingMode
{
    /// <summary>Render all videos as one flat list.</summary>
    Flat,

    /// <summary>Render videos grouped beneath season entities.</summary>
    Seasons
}

/// <summary>
/// Closed set of collection population strategies.
/// </summary>
public enum CollectionMode
{
    /// <summary>User-managed collection membership.</summary>
    Manual,

    /// <summary>Collection membership produced from stored rules.</summary>
    Dynamic,

    /// <summary>Collection combines manually pinned items with rule-produced items.</summary>
    Hybrid
}

/// <summary>
/// Closed set of collection cover generation strategies.
/// </summary>
public enum CollectionCoverMode
{
    /// <summary>Cover generated from multiple collection items.</summary>
    Mosaic,

    /// <summary>Cover supplied by an uploaded or generated image path.</summary>
    Custom,

    /// <summary>Cover borrowed from a specific collection item.</summary>
    Item
}

/// <summary>
/// Closed set of reasons an item appears inside a collection.
/// </summary>
public enum CollectionItemSource
{
    /// <summary>The user explicitly added the item.</summary>
    Manual,

    /// <summary>A collection rule selected the item.</summary>
    Dynamic
}

/// <summary>
/// Closed set of provider runtime shapes supported by the backend.
/// </summary>
public enum ProviderType
{
    /// <summary>Provider implemented as first-party .NET code.</summary>
    Native,

    /// <summary>Provider launched as a separate JSON stdin/stdout process.</summary>
    ExternalProcess,

    /// <summary>Provider that adapts a Stash-compatible source during import or migration.</summary>
    StashCompat
}

/// <summary>
/// Closed set of review states for provider identification results.
/// </summary>
public enum IdentifyResultStatus
{
    /// <summary>Result is waiting for review or application.</summary>
    Pending,

    /// <summary>Result was applied to the entity.</summary>
    Applied,

    /// <summary>Result was rejected by the user or rules engine.</summary>
    Rejected,

    /// <summary>Result could not be applied because provider data or persistence failed.</summary>
    Failed
}

/// <summary>
/// Closed set of statuses for outbound fingerprint submissions.
/// </summary>
public enum FingerprintSubmissionStatus
{
    /// <summary>Submission completed successfully.</summary>
    Success,

    /// <summary>Submission failed and the error field should explain why.</summary>
    Error
}

/// <summary>
/// Closed set of semantic roles a person can have for an entity credit.
/// </summary>
public enum EntityCreditRole
{
    /// <summary>Generic person credit; UI labels can translate this to actor, artist, author, or similar.</summary>
    Person
}

/// <summary>
/// Closed set of semantic file roles attached to entities.
/// </summary>
public enum EntityFileRole
{
    /// <summary>Original playable or readable source file.</summary>
    Source,

    /// <summary>Small generated thumbnail image.</summary>
    Thumbnail,

    /// <summary>Primary poster or cover artwork.</summary>
    Poster,

    /// <summary>Wide background artwork.</summary>
    Backdrop,

    /// <summary>Brand or title-logo artwork.</summary>
    Logo,

    /// <summary>Short preview clip or representative media file.</summary>
    Preview,

    /// <summary>Sprite sheet used for timeline previews.</summary>
    Sprite,

    /// <summary>Trickplay asset used during seeking.</summary>
    Trickplay,

    /// <summary>Audio waveform image or data asset.</summary>
    Waveform,

    /// <summary>Book, gallery, or audio cover image.</summary>
    Cover,

    /// <summary>HLS manifest or segment asset.</summary>
    Hls
}

/// <summary>
/// Closed set of subtitle discovery or generation sources.
/// </summary>
public enum EntitySubtitleSource
{
    /// <summary>User supplied subtitle file.</summary>
    Manual,

    /// <summary>Subtitle stream extracted from source media.</summary>
    Embedded,

    /// <summary>Subtitle generated by a local service.</summary>
    Generated,

    /// <summary>Subtitle imported from a metadata or subtitle provider.</summary>
    Provider
}

/// <summary>
/// Closed set of database backup lifecycle statuses.
/// </summary>
public enum DatabaseBackupStatus
{
    /// <summary>Backup process is currently running.</summary>
    Running,

    /// <summary>Backup finished and the output file is ready.</summary>
    Completed,

    /// <summary>Backup process failed and the error field should explain why.</summary>
    Failed
}

/// <summary>
/// Closed set of queue job types currently known to the .NET backend.
/// </summary>
public enum JobType
{
    /// <summary>No-operation job used to verify queue plumbing.</summary>
    Noop,

    /// <summary>Library scan job.</summary>
    ScanLibrary,

    /// <summary>Video probe job.</summary>
    ProbeVideo,

    /// <summary>Legacy v1 video import job.</summary>
    LegacyVideoImport,

    /// <summary>Legacy v1 media import job.</summary>
    LegacyMediaImport
}

/// <summary>
/// Closed set of queue job lifecycle statuses.
/// </summary>
public enum JobRunStatus
{
    /// <summary>Job is waiting to be claimed by a worker.</summary>
    Queued,

    /// <summary>Job has been claimed and is currently running.</summary>
    Running,

    /// <summary>Job finished successfully.</summary>
    Completed,

    /// <summary>Job exhausted retry rules or failed permanently.</summary>
    Failed,

    /// <summary>Job was cancelled before completion.</summary>
    Cancelled
}

/// <summary>
/// Closed set of subtitle rendering styles supported by the playback UI.
/// </summary>
public enum SubtitleStyle
{
    /// <summary>Obscura's styled subtitle presentation.</summary>
    Stylized,

    /// <summary>Plain browser-like subtitle presentation.</summary>
    Plain
}

/// <summary>
/// Closed set of preferred playback startup strategies.
/// </summary>
public enum PlaybackMode
{
    /// <summary>Try direct playback first when the browser can play the source.</summary>
    Direct,

    /// <summary>Use HLS playback when a stream is available or can be generated.</summary>
    Hls
}

/// <summary>
/// Stable text encoders for closed-set enum values used in the database and HTTP contracts.
/// </summary>
public static class ClosedSetCodeExtensions
{
    public static string ToCode(this BookType value) => value switch
    {
        BookType.Book => "book",
        BookType.Comic => "comic",
        BookType.Manga => "manga",
        BookType.Novel => "novel",
        _ => throw Unsupported(value)
    };

    public static string ToCode(this ReaderMode value) => value switch
    {
        ReaderMode.Paged => "paged",
        ReaderMode.Webtoon => "webtoon",
        _ => throw Unsupported(value)
    };

    public static string ToCode(this GalleryType value) => value switch
    {
        GalleryType.Virtual => "virtual",
        GalleryType.Folder => "folder",
        GalleryType.Zip => "zip",
        _ => throw Unsupported(value)
    };

    public static string ToCode(this VideoSeriesRenderingMode value) => value switch
    {
        VideoSeriesRenderingMode.Flat => "flat",
        VideoSeriesRenderingMode.Seasons => "seasons",
        _ => throw Unsupported(value)
    };

    public static string ToCode(this CollectionMode value) => value switch
    {
        CollectionMode.Manual => "manual",
        CollectionMode.Dynamic => "dynamic",
        CollectionMode.Hybrid => "hybrid",
        _ => throw Unsupported(value)
    };

    public static string ToCode(this CollectionCoverMode value) => value switch
    {
        CollectionCoverMode.Mosaic => "mosaic",
        CollectionCoverMode.Custom => "custom",
        CollectionCoverMode.Item => "item",
        _ => throw Unsupported(value)
    };

    public static string ToCode(this CollectionItemSource value) => value switch
    {
        CollectionItemSource.Manual => "manual",
        CollectionItemSource.Dynamic => "dynamic",
        _ => throw Unsupported(value)
    };

    public static string ToCode(this ProviderType value) => value switch
    {
        ProviderType.Native => "native",
        ProviderType.ExternalProcess => "external-process",
        ProviderType.StashCompat => "stash-compat",
        _ => throw Unsupported(value)
    };

    public static string ToCode(this IdentifyResultStatus value) => value switch
    {
        IdentifyResultStatus.Pending => "pending",
        IdentifyResultStatus.Applied => "applied",
        IdentifyResultStatus.Rejected => "rejected",
        IdentifyResultStatus.Failed => "failed",
        _ => throw Unsupported(value)
    };

    public static string ToCode(this FingerprintSubmissionStatus value) => value switch
    {
        FingerprintSubmissionStatus.Success => "success",
        FingerprintSubmissionStatus.Error => "error",
        _ => throw Unsupported(value)
    };

    public static string ToCode(this EntityCreditRole value) => value switch
    {
        EntityCreditRole.Person => "person",
        _ => throw Unsupported(value)
    };

    public static string ToCode(this EntityFileRole value) => value switch
    {
        EntityFileRole.Source => "source",
        EntityFileRole.Thumbnail => "thumbnail",
        EntityFileRole.Poster => "poster",
        EntityFileRole.Backdrop => "backdrop",
        EntityFileRole.Logo => "logo",
        EntityFileRole.Preview => "preview",
        EntityFileRole.Sprite => "sprite",
        EntityFileRole.Trickplay => "trickplay",
        EntityFileRole.Waveform => "waveform",
        EntityFileRole.Cover => "cover",
        EntityFileRole.Hls => "hls",
        _ => throw Unsupported(value)
    };

    public static string ToCode(this EntitySubtitleSource value) => value switch
    {
        EntitySubtitleSource.Manual => "manual",
        EntitySubtitleSource.Embedded => "embedded",
        EntitySubtitleSource.Generated => "generated",
        EntitySubtitleSource.Provider => "provider",
        _ => throw Unsupported(value)
    };

    public static string ToCode(this DatabaseBackupStatus value) => value switch
    {
        DatabaseBackupStatus.Running => "running",
        DatabaseBackupStatus.Completed => "completed",
        DatabaseBackupStatus.Failed => "failed",
        _ => throw Unsupported(value)
    };

    public static string ToCode(this JobType value) => value switch
    {
        JobType.Noop => "noop",
        JobType.ScanLibrary => "scan-library",
        JobType.ProbeVideo => "probe-video",
        JobType.LegacyVideoImport => "legacy-video-import",
        JobType.LegacyMediaImport => "legacy-media-import",
        _ => throw Unsupported(value)
    };

    public static string ToCode(this JobRunStatus value) => value switch
    {
        JobRunStatus.Queued => "queued",
        JobRunStatus.Running => "running",
        JobRunStatus.Completed => "completed",
        JobRunStatus.Failed => "failed",
        JobRunStatus.Cancelled => "cancelled",
        _ => throw Unsupported(value)
    };

    public static string ToCode(this SubtitleStyle value) => value switch
    {
        SubtitleStyle.Stylized => "stylized",
        SubtitleStyle.Plain => "plain",
        _ => throw Unsupported(value)
    };

    public static string ToCode(this PlaybackMode value) => value switch
    {
        PlaybackMode.Direct => "direct",
        PlaybackMode.Hls => "hls",
        _ => throw Unsupported(value)
    };

    public static BookType ToBookType(this string code) => Normalize(code) switch
    {
        "book" => BookType.Book,
        "comic" => BookType.Comic,
        "manga" => BookType.Manga,
        "novel" => BookType.Novel,
        _ => throw Unsupported<BookType>(code)
    };

    public static ReaderMode ToReaderMode(this string code) => Normalize(code) switch
    {
        "paged" => ReaderMode.Paged,
        "webtoon" => ReaderMode.Webtoon,
        _ => throw Unsupported<ReaderMode>(code)
    };

    public static GalleryType ToGalleryType(this string code) => Normalize(code) switch
    {
        "virtual" => GalleryType.Virtual,
        "folder" => GalleryType.Folder,
        "zip" => GalleryType.Zip,
        _ => throw Unsupported<GalleryType>(code)
    };

    public static VideoSeriesRenderingMode ToVideoSeriesRenderingMode(this string code) => Normalize(code) switch
    {
        "flat" => VideoSeriesRenderingMode.Flat,
        "seasons" => VideoSeriesRenderingMode.Seasons,
        _ => throw Unsupported<VideoSeriesRenderingMode>(code)
    };

    public static CollectionMode ToCollectionMode(this string code) => Normalize(code) switch
    {
        "manual" => CollectionMode.Manual,
        "dynamic" => CollectionMode.Dynamic,
        "hybrid" => CollectionMode.Hybrid,
        _ => throw Unsupported<CollectionMode>(code)
    };

    public static CollectionCoverMode ToCollectionCoverMode(this string code) => Normalize(code) switch
    {
        "mosaic" => CollectionCoverMode.Mosaic,
        "custom" => CollectionCoverMode.Custom,
        "item" => CollectionCoverMode.Item,
        _ => throw Unsupported<CollectionCoverMode>(code)
    };

    public static CollectionItemSource ToCollectionItemSource(this string code) => Normalize(code) switch
    {
        "manual" => CollectionItemSource.Manual,
        "dynamic" => CollectionItemSource.Dynamic,
        _ => throw Unsupported<CollectionItemSource>(code)
    };

    public static ProviderType ToProviderType(this string code) => Normalize(code) switch
    {
        "native" => ProviderType.Native,
        "external-process" => ProviderType.ExternalProcess,
        "stash-compat" => ProviderType.StashCompat,
        _ => throw Unsupported<ProviderType>(code)
    };

    public static IdentifyResultStatus ToIdentifyResultStatus(this string code) => Normalize(code) switch
    {
        "pending" => IdentifyResultStatus.Pending,
        "applied" => IdentifyResultStatus.Applied,
        "rejected" => IdentifyResultStatus.Rejected,
        "failed" => IdentifyResultStatus.Failed,
        _ => throw Unsupported<IdentifyResultStatus>(code)
    };

    public static FingerprintSubmissionStatus ToFingerprintSubmissionStatus(this string code) => Normalize(code) switch
    {
        "success" => FingerprintSubmissionStatus.Success,
        "error" => FingerprintSubmissionStatus.Error,
        _ => throw Unsupported<FingerprintSubmissionStatus>(code)
    };

    public static EntityCreditRole ToEntityCreditRole(this string code) => Normalize(code) switch
    {
        "person" => EntityCreditRole.Person,
        _ => throw Unsupported<EntityCreditRole>(code)
    };

    public static EntityFileRole ToEntityFileRole(this string code) => Normalize(code) switch
    {
        "source" => EntityFileRole.Source,
        "thumbnail" => EntityFileRole.Thumbnail,
        "poster" => EntityFileRole.Poster,
        "backdrop" => EntityFileRole.Backdrop,
        "logo" => EntityFileRole.Logo,
        "preview" => EntityFileRole.Preview,
        "sprite" => EntityFileRole.Sprite,
        "trickplay" => EntityFileRole.Trickplay,
        "waveform" => EntityFileRole.Waveform,
        "cover" => EntityFileRole.Cover,
        "hls" => EntityFileRole.Hls,
        _ => throw Unsupported<EntityFileRole>(code)
    };

    public static EntitySubtitleSource ToEntitySubtitleSource(this string code) => Normalize(code) switch
    {
        "manual" => EntitySubtitleSource.Manual,
        "embedded" => EntitySubtitleSource.Embedded,
        "generated" => EntitySubtitleSource.Generated,
        "provider" => EntitySubtitleSource.Provider,
        _ => throw Unsupported<EntitySubtitleSource>(code)
    };

    public static DatabaseBackupStatus ToDatabaseBackupStatus(this string code) => Normalize(code) switch
    {
        "running" => DatabaseBackupStatus.Running,
        "completed" => DatabaseBackupStatus.Completed,
        "failed" => DatabaseBackupStatus.Failed,
        _ => throw Unsupported<DatabaseBackupStatus>(code)
    };

    public static JobType ToJobType(this string code) => Normalize(code) switch
    {
        "noop" => JobType.Noop,
        "scan-library" => JobType.ScanLibrary,
        "probe-video" => JobType.ProbeVideo,
        "legacy-video-import" => JobType.LegacyVideoImport,
        "legacy-media-import" => JobType.LegacyMediaImport,
        _ => throw Unsupported<JobType>(code)
    };

    public static bool TryToJobType(this string code, out JobType jobType)
    {
        try
        {
            jobType = code.ToJobType();
            return true;
        }
        catch (ArgumentOutOfRangeException)
        {
            jobType = default;
            return false;
        }
    }

    public static JobRunStatus ToJobRunStatus(this string code) => Normalize(code) switch
    {
        "queued" => JobRunStatus.Queued,
        "running" => JobRunStatus.Running,
        "completed" => JobRunStatus.Completed,
        "failed" => JobRunStatus.Failed,
        "cancelled" => JobRunStatus.Cancelled,
        _ => throw Unsupported<JobRunStatus>(code)
    };

    public static SubtitleStyle ToSubtitleStyle(this string code) => Normalize(code) switch
    {
        "stylized" => SubtitleStyle.Stylized,
        "plain" => SubtitleStyle.Plain,
        _ => throw Unsupported<SubtitleStyle>(code)
    };

    public static PlaybackMode ToPlaybackMode(this string code) => Normalize(code) switch
    {
        "direct" => PlaybackMode.Direct,
        "hls" => PlaybackMode.Hls,
        _ => throw Unsupported<PlaybackMode>(code)
    };

    private static string Normalize(string code) => code.Trim().ToLowerInvariant();

    private static ArgumentOutOfRangeException Unsupported<TEnum>(string code)
        where TEnum : struct, Enum =>
        new(nameof(code), code, $"Unsupported {typeof(TEnum).Name} code.");

    private static ArgumentOutOfRangeException Unsupported<TEnum>(TEnum value)
        where TEnum : struct, Enum =>
        new(nameof(value), value, $"Unsupported {typeof(TEnum).Name} value.");
}

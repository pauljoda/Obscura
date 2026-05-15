using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Ports;

/// <summary>
/// Port for entity persistence operations during library scanning. Handles the create/update/delete
/// lifecycle for entities discovered by file system scans.
/// </summary>
public interface ILibraryScanPersistence
{
    // ── Library roots & settings ──

    Task<LibraryRootData?> GetLibraryRootAsync(Guid rootId, CancellationToken cancellationToken);
    Task<IReadOnlyList<LibraryRootData>> GetEnabledRootsAsync(CancellationToken cancellationToken);
    Task<LibrarySettingsData> GetSettingsAsync(CancellationToken cancellationToken);
    Task UpdateRootLastScannedAsync(Guid rootId, CancellationToken cancellationToken);

    // ── Entity upsert (returns entity ID) ──

    Task<Guid> UpsertVideoAsync(string filePath, string title, Guid libraryRootId, bool isNsfw, CancellationToken cancellationToken);
    Task<Guid> UpsertImageAsync(string filePath, string title, Guid? galleryEntityId, long? sizeBytes, int sortOrder, bool isNsfw, CancellationToken cancellationToken);
    Task<Guid> UpsertGalleryAsync(string folderPath, string title, bool isNsfw, CancellationToken cancellationToken);
    Task<Guid> UpsertAudioTrackAsync(string filePath, string title, Guid audioLibraryId, int sortOrder, bool isNsfw, CancellationToken cancellationToken);
    Task<Guid> UpsertAudioLibraryAsync(string folderPath, string title, bool isNsfw, CancellationToken cancellationToken);
    Task<Guid> UpsertBookAsync(string archivePath, string title, bool isNsfw, CancellationToken cancellationToken);
    Task<Guid> UpsertBookChapterAsync(string archivePath, string title, Guid bookEntityId, int pageCount, bool isNsfw, CancellationToken cancellationToken);
    Task<Guid> UpsertBookPageAsync(string filePath, string title, Guid bookEntityId, Guid chapterEntityId, int sortOrder, bool isNsfw, CancellationToken cancellationToken);

    // ── Stale entity cleanup ──

    Task<int> RemoveStaleVideosByRootAsync(Guid rootId, IReadOnlySet<string> validPaths, CancellationToken cancellationToken);
    Task<int> RemoveStaleImagesInGalleryAsync(Guid galleryEntityId, IReadOnlySet<string> validPaths, CancellationToken cancellationToken);
    Task<int> RemoveStaleGalleriesInRootAsync(Guid rootId, IReadOnlySet<string> validFolderPaths, CancellationToken cancellationToken);
    Task<int> RemoveStaleAudioTracksInLibraryAsync(Guid libraryEntityId, IReadOnlySet<string> validPaths, CancellationToken cancellationToken);
    Task<int> RemoveStaleAudioLibrariesInRootAsync(Guid rootId, IReadOnlySet<string> validFolderPaths, CancellationToken cancellationToken);
    Task<int> RemoveStaleBookChaptersAsync(Guid bookEntityId, IReadOnlySet<string> validArchivePaths, CancellationToken cancellationToken);
    Task<int> RemoveStaleBooksInRootAsync(Guid rootId, IReadOnlySet<string> validPaths, CancellationToken cancellationToken);

    // ── Batch upsert ──

    /// <summary>
    /// Upserts a batch of video entities in a single database round-trip,
    /// returning the entity ID for each input file path in the same order.
    /// </summary>
    Task<IReadOnlyList<Guid>> UpsertVideosBatchAsync(
        IReadOnlyList<VideoUpsertItem> items, CancellationToken cancellationToken);

    /// <summary>
    /// Checks what downstream jobs are needed for a batch of entities in a single query.
    /// Returns one <see cref="DownstreamNeeds"/> per entity ID.
    /// </summary>
    Task<IReadOnlyDictionary<Guid, DownstreamNeeds>> CheckDownstreamNeedsBatchAsync(
        IReadOnlyList<Guid> entityIds, CancellationToken cancellationToken);

    // ── Reads for downstream chaining decisions ──

    Task<bool> HasEntityTechnicalAsync(Guid entityId, CancellationToken cancellationToken);
    Task<bool> HasEntityFingerprintAsync(Guid entityId, FingerprintAlgorithm algorithm, CancellationToken cancellationToken);
    Task<bool> HasEntityFileAsync(Guid entityId, EntityFileRole role, CancellationToken cancellationToken);
    Task<bool> HasSubtitlesExtractedAsync(Guid entityId, CancellationToken cancellationToken);

    // ── Entity technical / file / fingerprint writes ──

    Task UpsertEntityTechnicalAsync(Guid entityId, double? duration, int? width, int? height,
        double? frameRate, int? bitRate, int? sampleRate, int? channels,
        string? codec, string? container, string? format, CancellationToken cancellationToken);

    Task UpsertMediaSourceAsync(
        Guid entityId,
        string path,
        MediaSourceProbeData source,
        IReadOnlyList<MediaStreamProbeData> streams,
        CancellationToken cancellationToken);

    Task UpsertEntityFileAsync(Guid entityId, EntityFileRole role, string path, string? mimeType, long? sizeBytes, CancellationToken cancellationToken);

    Task UpsertEntityFingerprintAsync(Guid entityId, FingerprintAlgorithm algorithm, string value, Guid? entityFileId, CancellationToken cancellationToken);

    Task<Guid?> GetSourceFileIdAsync(Guid entityId, CancellationToken cancellationToken);

    Task<string?> GetSourceFilePathAsync(Guid entityId, CancellationToken cancellationToken);

    Task MarkSubtitlesExtractedAsync(Guid entityId, CancellationToken cancellationToken);

    Task UpsertSubtitleAsync(Guid entityId, string language, string? label, string format,
        EntitySubtitleSource source, string storagePath, string sourceFormat, int streamIndex, CancellationToken cancellationToken);

    Task UpsertAudioTrackTagsAsync(Guid entityId, string? artist, string? album, CancellationToken cancellationToken);

    Task<EntityTechnicalData?> GetEntityTechnicalAsync(Guid entityId, CancellationToken cancellationToken);
}

public sealed record LibraryRootData(
    Guid Id,
    string Path,
    string Label,
    bool Enabled,
    bool Recursive,
    bool ScanVideos,
    bool ScanImages,
    bool ScanAudio,
    bool ScanBooks,
    bool IsNsfw);

public sealed record EntityTechnicalData(
    double? DurationSeconds,
    int? Width,
    int? Height,
    double? FrameRate,
    int? BitRate,
    int? SampleRate,
    int? Channels,
    string? Codec,
    string? Container);

public sealed record MediaSourceProbeData(
    double? DurationSeconds,
    long? SizeBytes,
    int? BitRate,
    string? Container,
    string? VideoCodec,
    string? AudioCodec,
    int? Width,
    int? Height,
    double? FrameRate);

public sealed record MediaStreamProbeData(
    int StreamIndex,
    string Type,
    string? Codec,
    string? Language,
    string? Title,
    int? Width,
    int? Height,
    double? FrameRate,
    int? BitRate,
    int? SampleRate,
    int? Channels,
    bool IsDefault,
    bool IsForced);

public sealed record LibrarySettingsData(
    bool AutoGenerateMetadata,
    bool AutoGenerateFingerprints,
    bool GeneratePhash,
    bool AutoGeneratePreview,
    bool GenerateTrickplay,
    int TrickplayIntervalSeconds,
    int PreviewClipDurationSeconds,
    int ThumbnailQuality,
    int TrickplayQuality);

public sealed record VideoUpsertItem(
    string FilePath,
    string Title,
    Guid LibraryRootId,
    bool IsNsfw);

/// <summary>
/// Flags indicating which downstream jobs are still needed for an entity.
/// </summary>
public sealed record DownstreamNeeds(
    bool NeedsProbe,
    bool NeedsFingerprint,
    bool NeedsPreview,
    bool NeedsSubtitleExtraction);

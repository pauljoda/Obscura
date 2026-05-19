namespace Obscura.Domain.Entities;

/// <summary>
/// Closed set of queue job types known to the .NET backend.
/// Each value maps 1:1 to a processor that the worker can dispatch.
/// </summary>
public enum JobType {
    /// <summary>No-operation job used to verify queue plumbing.</summary>
    Noop,

    // ── Scanning ────────────────────────────────────────────────
    /// <summary>Discovers video files in a library root.</summary>
    ScanLibrary,

    /// <summary>Discovers image galleries in a library root.</summary>
    ScanGallery,

    /// <summary>Discovers comic books in a library root.</summary>
    ScanBook,

    /// <summary>Discovers audio tracks in a library root.</summary>
    ScanAudio,

    // ── Probing ─────────────────────────────────────────────────
    /// <summary>Extracts technical metadata from a video file via ffprobe.</summary>
    ProbeVideo,

    /// <summary>Extracts technical metadata and embedded tags from an audio file.</summary>
    ProbeAudio,

    // ── Fingerprinting ──────────────────────────────────────────
    /// <summary>Computes MD5, oshash, and optional perceptual hash for a video.</summary>
    FingerprintVideo,

    /// <summary>Computes MD5 and oshash for an image.</summary>
    FingerprintImage,

    /// <summary>Computes MD5 and oshash for an audio track.</summary>
    FingerprintAudio,

    // ── Preview / asset generation ──────────────────────────────
    /// <summary>Builds video thumbnails, preview clips, and trickplay sprites.</summary>
    GeneratePreview,

    /// <summary>Generates thumbnails and lightweight previews for images.</summary>
    GenerateImageThumbnail,

    /// <summary>Generates thumbnails for comic book pages.</summary>
    GenerateBookPageThumbnail,

    /// <summary>Generates waveform peak data for audio playback visualization.</summary>
    GenerateAudioWaveform,

    /// <summary>Extracts embedded subtitle tracks from video files as WebVTT.</summary>
    ExtractSubtitles,

    // ── Metadata / collections ──────────────────────────────────
    /// <summary>Coordinates provider imports and metadata application.</summary>
    ImportMetadata,

    /// <summary>Re-evaluates dynamic collection rules and updates membership.</summary>
    RefreshCollection,

    /// <summary>Moves video-derived assets between cache and media-adjacent storage.</summary>
    LibraryMaintenance
}

/// <summary>
/// Codec for queue job type codes.
/// </summary>
public sealed class JobTypeCodec : EnumCodec<JobType> {
    public JobTypeCodec()
        : base(new Dictionary<JobType, string> {
            [JobType.Noop] = "noop",
            [JobType.ScanLibrary] = "scan-library",
            [JobType.ScanGallery] = "scan-gallery",
            [JobType.ScanBook] = "scan-book",
            [JobType.ScanAudio] = "scan-audio",
            [JobType.ProbeVideo] = "probe-video",
            [JobType.ProbeAudio] = "probe-audio",
            [JobType.FingerprintVideo] = "fingerprint-video",
            [JobType.FingerprintImage] = "fingerprint-image",
            [JobType.FingerprintAudio] = "fingerprint-audio",
            [JobType.GeneratePreview] = "generate-preview",
            [JobType.GenerateImageThumbnail] = "generate-image-thumbnail",
            [JobType.GenerateBookPageThumbnail] = "generate-book-page-thumbnail",
            [JobType.GenerateAudioWaveform] = "generate-audio-waveform",
            [JobType.ExtractSubtitles] = "extract-subtitles",
            [JobType.ImportMetadata] = "import-metadata",
            [JobType.RefreshCollection] = "refresh-collection",
            [JobType.LibraryMaintenance] = "library-maintenance"
        }) {
    }
}

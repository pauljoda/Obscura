namespace Obscura.Application.Settings;

/// <summary>
/// Application settings values used by the single-user UI shell.
/// </summary>
public sealed record SettingsResult(
    bool HideNsfw,
    bool EnableCastControls);

/// <summary>
/// Application command for partially updating shell settings.
/// </summary>
public sealed record SettingsUpdate(
    bool? HideNsfw,
    bool? EnableCastControls);

/// <summary>
/// Application settings values used by the library settings page.
/// <see cref="HideNsfw"/> is carried alongside the rest of the library settings record so the
/// Application layer can read and write the persisted state in one round-trip; the shell
/// settings endpoint exposes it on <see cref="SettingsResult"/> while the library settings
/// page does not surface it as a separately editable field.
/// </summary>
public sealed record LibrarySettingsResult(
    Guid Id,
    bool AutoScanEnabled,
    int ScanIntervalMinutes,
    bool AutoGenerateMetadata,
    bool AutoGenerateFingerprints,
    bool GeneratePhash,
    bool AutoGeneratePreview,
    bool GenerateTrickplay,
    int TrickplayIntervalSeconds,
    int PreviewClipDurationSeconds,
    int ThumbnailQuality,
    int TrickplayQuality,
    int BackgroundWorkerConcurrency,
    bool NsfwLanAutoEnable,
    bool MetadataStorageDedicated,
    bool SubtitlesAutoEnable,
    string SubtitlesPreferredLanguages,
    string AudioPreferredLanguages,
    string SubtitleStyle,
    float SubtitleFontScale,
    float SubtitlePositionPercent,
    float SubtitleOpacity,
    string DefaultPlaybackMode,
    bool ShowCastControls,
    string HlsTranscoderProfile,
    string HlsFfmpegPath,
    string HlsVaapiDevice,
    bool HideNsfw,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

/// <summary>
/// Application command for partially updating library settings.
/// </summary>
public sealed record LibrarySettingsUpdate(
    bool? AutoScanEnabled,
    int? ScanIntervalMinutes,
    bool? AutoGenerateMetadata,
    bool? AutoGenerateFingerprints,
    bool? GeneratePhash,
    bool? AutoGeneratePreview,
    bool? GenerateTrickplay,
    int? TrickplayIntervalSeconds,
    int? PreviewClipDurationSeconds,
    int? ThumbnailQuality,
    int? TrickplayQuality,
    int? BackgroundWorkerConcurrency,
    bool? NsfwLanAutoEnable,
    bool? MetadataStorageDedicated,
    bool? SubtitlesAutoEnable,
    string? SubtitlesPreferredLanguages,
    string? AudioPreferredLanguages,
    string? SubtitleStyle,
    float? SubtitleFontScale,
    float? SubtitlePositionPercent,
    float? SubtitleOpacity,
    string? DefaultPlaybackMode,
    bool? ShowCastControls,
    string? HlsTranscoderProfile,
    string? HlsFfmpegPath,
    string? HlsVaapiDevice);

/// <summary>
/// Application result for one watched media root.
/// </summary>
public sealed record LibraryRootResult(
    Guid Id,
    string Path,
    string Label,
    bool Enabled,
    bool Recursive,
    bool ScanVideos,
    bool ScanImages,
    bool ScanAudio,
    bool ScanBooks,
    bool IsNsfw,
    DateTimeOffset? LastScannedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

/// <summary>
/// Application result containing library settings and watched roots.
/// </summary>
public sealed record LibraryConfigResult(
    LibrarySettingsResult Settings,
    IReadOnlyList<LibraryRootResult> Roots);

/// <summary>
/// Application command for adding a watched media root.
/// </summary>
public sealed record LibraryRootCreate(
    string Path,
    string? Label,
    bool? Enabled,
    bool? Recursive,
    bool? ScanVideos,
    bool? ScanImages,
    bool? ScanAudio,
    bool? ScanBooks,
    bool? IsNsfw);

/// <summary>
/// Application command for partially updating a watched media root.
/// </summary>
public sealed record LibraryRootUpdate(
    string? Path,
    string? Label,
    bool? Enabled,
    bool? Recursive,
    bool? ScanVideos,
    bool? ScanImages,
    bool? ScanAudio,
    bool? ScanBooks,
    bool? IsNsfw);

/// <summary>
/// Application result for one local directory browser entry.
/// </summary>
public sealed record LibraryBrowseEntryResult(string Name, string Path);

/// <summary>
/// Application result for local watched-root directory browsing.
/// </summary>
public sealed record LibraryBrowseResult(
    string Path,
    string? ParentPath,
    IReadOnlyList<LibraryBrowseEntryResult> Directories);

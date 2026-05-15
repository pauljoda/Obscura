namespace Obscura.Contracts.Settings;

/// <summary>
/// API-facing settings values used by the v2 UI.
/// </summary>
/// <param name="HideNsfw">Whether NSFW media should be hidden by default.</param>
/// <param name="EnableCastControls">Whether cast controls should be shown in playback controls.</param>
public sealed record SettingsResponse(
    bool HideNsfw,
    bool EnableCastControls);

/// <summary>
/// Request body for partially updating v2 settings.
/// </summary>
/// <param name="HideNsfw">Optional hide-NSFW setting value.</param>
/// <param name="EnableCastControls">Optional cast-control setting value.</param>
public sealed record SettingsUpdateRequest(
    bool? HideNsfw,
    bool? EnableCastControls);

/// <summary>
/// API-facing settings values used by the migrated settings page.
/// </summary>
public sealed record LibrarySettings(
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
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

/// <summary>
/// Partial settings update request used by auto-save controls.
/// </summary>
public sealed record LibrarySettingsUpdateRequest(
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
    bool? ShowCastControls);

/// <summary>
/// API-facing watched media root.
/// </summary>
public sealed record LibraryRoot(
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
/// Settings page payload containing global settings and watched roots.
/// </summary>
public sealed record LibraryConfigResponse(
    LibrarySettings Settings,
    IReadOnlyList<LibraryRoot> Roots);

/// <summary>
/// Request body for creating a watched media root.
/// </summary>
public sealed record LibraryRootCreateRequest(
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
/// Request body for updating a watched media root.
/// </summary>
public sealed record LibraryRootUpdateRequest(
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
/// Directory entry used by the local folder browser.
/// </summary>
public sealed record LibraryBrowseEntry(string Name, string Path);

/// <summary>
/// Local folder browser response.
/// </summary>
public sealed record LibraryBrowseResponse(
    string Path,
    string? ParentPath,
    IReadOnlyList<LibraryBrowseEntry> Directories);

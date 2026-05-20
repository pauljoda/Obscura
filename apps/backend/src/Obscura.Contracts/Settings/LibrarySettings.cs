namespace Obscura.Contracts.Settings;

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
    string HlsTranscoderProfile,
    string HlsFfmpegPath,
    string HlsVaapiDevice,
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
    bool? ShowCastControls,
    string? HlsTranscoderProfile,
    string? HlsFfmpegPath,
    string? HlsVaapiDevice);

/// <summary>
/// Settings page payload containing global settings and watched roots.
/// </summary>
public sealed record LibraryConfigResponse(
    LibrarySettings Settings,
    IReadOnlyList<LibraryRoot> Roots);

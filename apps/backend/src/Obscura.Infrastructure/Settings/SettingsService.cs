using Microsoft.EntityFrameworkCore;
using Obscura.Application.Settings;
using Obscura.Contracts.Settings;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Settings;

public sealed class SettingsService : ISettingsService
{
    private readonly ObscuraDbContext _db;

    public SettingsService(ObscuraDbContext db)
    {
        _db = db;
    }

    public async Task<SettingsResponse> GetAsync(CancellationToken cancellationToken)
    {
        var row = await EnsureRowAsync(cancellationToken);
        return ToContract(row);
    }

    public async Task<SettingsResponse> UpdateAsync(SettingsUpdateRequest request, CancellationToken cancellationToken)
    {
        var row = await EnsureRowAsync(cancellationToken);

        if (request.HideNsfw is { } hideNsfw)
        {
            row.HideNsfw = hideNsfw;
        }

        if (request.EnableCastControls is { } enableCastControls)
        {
            row.ShowCastControls = enableCastControls;
        }

        row.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return ToContract(row);
    }

    public async Task<LibraryConfigResponse> GetLibraryConfigAsync(CancellationToken cancellationToken)
    {
        var settings = await EnsureRowAsync(cancellationToken);
        var roots = await _db.LibraryRoots
            .AsNoTracking()
            .OrderBy(root => root.Label)
            .ThenBy(root => root.Path)
            .Select(root => ToContract(root))
            .ToArrayAsync(cancellationToken);

        return new LibraryConfigResponse(ToLibrarySettings(settings), roots);
    }

    public async Task<LibrarySettings> UpdateLibrarySettingsAsync(
        LibrarySettingsUpdateRequest request,
        CancellationToken cancellationToken)
    {
        var row = await EnsureRowAsync(cancellationToken);

        if (request.AutoScanEnabled is { } autoScanEnabled) row.AutoScanEnabled = autoScanEnabled;
        if (request.ScanIntervalMinutes is { } scanIntervalMinutes) row.ScanIntervalMinutes = Math.Clamp(scanIntervalMinutes, 5, 1440);
        if (request.AutoGenerateMetadata is { } autoGenerateMetadata) row.AutoGenerateMetadata = autoGenerateMetadata;
        if (request.AutoGenerateFingerprints is { } autoGenerateFingerprints) row.AutoGenerateFingerprints = autoGenerateFingerprints;
        if (request.GeneratePhash is { } generatePhash) row.GeneratePhash = generatePhash;
        if (request.AutoGeneratePreview is { } autoGeneratePreview) row.AutoGeneratePreview = autoGeneratePreview;
        if (request.GenerateTrickplay is { } generateTrickplay) row.GenerateTrickplay = generateTrickplay;
        if (request.TrickplayIntervalSeconds is { } trickplayIntervalSeconds) row.TrickplayIntervalSeconds = Math.Clamp(trickplayIntervalSeconds, 1, 60);
        if (request.PreviewClipDurationSeconds is { } previewClipDurationSeconds) row.PreviewClipDurationSeconds = Math.Clamp(previewClipDurationSeconds, 2, 60);
        if (request.ThumbnailQuality is { } thumbnailQuality) row.ThumbnailQuality = Math.Clamp(thumbnailQuality, 1, 5);
        if (request.TrickplayQuality is { } trickplayQuality) row.TrickplayQuality = Math.Clamp(trickplayQuality, 1, 5);
        if (request.BackgroundWorkerConcurrency is { } backgroundWorkerConcurrency) row.BackgroundWorkerConcurrency = Math.Clamp(backgroundWorkerConcurrency, 1, 32);
        if (request.NsfwLanAutoEnable is { } nsfwLanAutoEnable) row.NsfwLanAutoEnable = nsfwLanAutoEnable;
        if (request.MetadataStorageDedicated is { } metadataStorageDedicated) row.MetadataStorageDedicated = metadataStorageDedicated;
        if (request.SubtitlesAutoEnable is { } subtitlesAutoEnable) row.SubtitlesAutoEnable = subtitlesAutoEnable;
        if (request.SubtitlesPreferredLanguages is not null) row.SubtitlesPreferredLanguages = request.SubtitlesPreferredLanguages;
        if (request.SubtitleStyle is not null && request.SubtitleStyle.TryDecodeAs<SubtitleStyle>(out var subtitleStyle)) row.SubtitleStyle = subtitleStyle;
        if (request.SubtitleFontScale is { } subtitleFontScale) row.SubtitleFontScale = Math.Clamp(subtitleFontScale, 0.5f, 3f);
        if (request.SubtitlePositionPercent is { } subtitlePositionPercent) row.SubtitlePositionPercent = Math.Clamp(subtitlePositionPercent, 0, 100);
        if (request.SubtitleOpacity is { } subtitleOpacity) row.SubtitleOpacity = Math.Clamp(subtitleOpacity, 0.2f, 1f);
        if (request.DefaultPlaybackMode is not null && request.DefaultPlaybackMode.TryDecodeAs<PlaybackMode>(out var playbackMode)) row.DefaultPlaybackMode = playbackMode;
        if (request.ShowCastControls is { } showCastControls) row.ShowCastControls = showCastControls;

        row.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return ToLibrarySettings(row);
    }

    public Task<LibraryBrowseResponse> BrowseLibraryPathAsync(
        string? path,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var requestedPath = string.IsNullOrWhiteSpace(path)
            ? Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)
            : path;
        var directory = new DirectoryInfo(requestedPath);
        if (!directory.Exists)
        {
            directory = new DirectoryInfo(Path.GetPathRoot(requestedPath) ?? "/");
        }

        var directories = directory.EnumerateDirectories()
            .Where(child => !child.Attributes.HasFlag(FileAttributes.Hidden))
            .OrderBy(child => child.Name)
            .Select(child => new LibraryBrowseEntry(child.Name, child.FullName))
            .ToArray();

        return Task.FromResult(new LibraryBrowseResponse(
            directory.FullName,
            directory.Parent?.FullName,
            directories));
    }

    public async Task<LibraryRoot> CreateLibraryRootAsync(
        LibraryRootCreateRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(request.Path);

        var now = DateTimeOffset.UtcNow;
        var label = string.IsNullOrWhiteSpace(request.Label)
            ? new DirectoryInfo(request.Path).Name
            : request.Label.Trim();
        if (string.IsNullOrWhiteSpace(label))
        {
            label = request.Path;
        }

        var row = new LibraryRootRow
        {
            Id = Guid.NewGuid(),
            Path = request.Path,
            Label = label,
            Enabled = request.Enabled ?? true,
            Recursive = request.Recursive ?? true,
            ScanVideos = request.ScanVideos ?? true,
            ScanImages = request.ScanImages ?? true,
            ScanAudio = request.ScanAudio ?? true,
            ScanBooks = request.ScanBooks ?? false,
            IsNsfw = request.IsNsfw ?? false,
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.LibraryRoots.Add(row);
        await _db.SaveChangesAsync(cancellationToken);

        return ToContract(row);
    }

    public async Task<LibraryRoot?> UpdateLibraryRootAsync(
        Guid id,
        LibraryRootUpdateRequest request,
        CancellationToken cancellationToken)
    {
        var row = await _db.LibraryRoots.FindAsync([id], cancellationToken);
        if (row is null)
        {
            return null;
        }

        if (!string.IsNullOrWhiteSpace(request.Path)) row.Path = request.Path;
        if (request.Label is not null) row.Label = request.Label;
        if (request.Enabled is { } enabled) row.Enabled = enabled;
        if (request.Recursive is { } recursive) row.Recursive = recursive;
        if (request.ScanVideos is { } scanVideos) row.ScanVideos = scanVideos;
        if (request.ScanImages is { } scanImages) row.ScanImages = scanImages;
        if (request.ScanAudio is { } scanAudio) row.ScanAudio = scanAudio;
        if (request.ScanBooks is { } scanBooks) row.ScanBooks = scanBooks;
        if (request.IsNsfw is { } isNsfw) row.IsNsfw = isNsfw;

        row.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return ToContract(row);
    }

    public async Task<bool> DeleteLibraryRootAsync(Guid id, CancellationToken cancellationToken)
    {
        var row = await _db.LibraryRoots.FindAsync([id], cancellationToken);
        if (row is null)
        {
            return false;
        }

        _db.LibraryRoots.Remove(row);
        await _db.SaveChangesAsync(cancellationToken);

        return true;
    }

    private async Task<LibrarySettingsRow> EnsureRowAsync(CancellationToken cancellationToken)
    {
        var row = await _db.LibrarySettings
            .OrderBy(settings => settings.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (row is not null)
        {
            return row;
        }

        var now = DateTimeOffset.UtcNow;
        row = new LibrarySettingsRow
        {
            Id = Guid.NewGuid(),
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.LibrarySettings.Add(row);
        await _db.SaveChangesAsync(cancellationToken);

        return row;
    }

    private static SettingsResponse ToContract(LibrarySettingsRow row)
    {
        return new SettingsResponse(
            HideNsfw: row.HideNsfw,
            EnableCastControls: row.ShowCastControls);
    }

    private static LibrarySettings ToLibrarySettings(LibrarySettingsRow row)
    {
        return new LibrarySettings(
            row.Id,
            row.AutoScanEnabled,
            row.ScanIntervalMinutes,
            row.AutoGenerateMetadata,
            row.AutoGenerateFingerprints,
            row.GeneratePhash,
            row.AutoGeneratePreview,
            row.GenerateTrickplay,
            row.TrickplayIntervalSeconds,
            row.PreviewClipDurationSeconds,
            row.ThumbnailQuality,
            row.TrickplayQuality,
            row.BackgroundWorkerConcurrency,
            row.NsfwLanAutoEnable,
            row.MetadataStorageDedicated,
            row.SubtitlesAutoEnable,
            row.SubtitlesPreferredLanguages,
            row.SubtitleStyle.ToCode(),
            row.SubtitleFontScale,
            row.SubtitlePositionPercent,
            row.SubtitleOpacity,
            row.DefaultPlaybackMode.ToCode(),
            row.ShowCastControls,
            row.CreatedAt,
            row.UpdatedAt);
    }

    private static LibraryRoot ToContract(LibraryRootRow row)
    {
        return new LibraryRoot(
            row.Id,
            row.Path,
            row.Label,
            row.Enabled,
            row.Recursive,
            row.ScanVideos,
            row.ScanImages,
            row.ScanAudio,
            row.ScanBooks,
            row.IsNsfw,
            row.LastScannedAt,
            row.CreatedAt,
            row.UpdatedAt);
    }
}

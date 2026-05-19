using Obscura.Application.Jobs;
using Obscura.Application.Organization;
using Obscura.Application.Settings;
using Obscura.Application.Videos;
using Obscura.Contracts.Jobs;
using Obscura.Contracts.Organize;
using Obscura.Contracts.Playback;
using Obscura.Contracts.Settings;

namespace Obscura.Api.Mapping;

internal static class ApplicationContractMapping
{
    public static JobListResponse ToContract(this JobListResult result) =>
        new(result.Items.Select(ToContract).ToArray(), result.Counts.Select(ToContract).ToArray());

    public static JobCreateResponse ToContract(this JobCreateResult result) =>
        new(result.Job.ToContract());

    public static JobCancelResponse ToContract(this JobCancelResult result) =>
        new(result.Cancelled);

    public static JobFailureClearResponse ToContract(this JobFailureClearResult result) =>
        new(result.Cleared);

    public static BulkJobResponse ToContract(this BulkJobResult result) =>
        new(result.Enqueued, result.Skipped);

    public static JobRun ToContract(this JobRunResult result) =>
        new(
            result.Id,
            result.Type,
            result.Status,
            result.Progress,
            result.Message,
            result.TargetKind,
            result.TargetId,
            result.TargetLabel,
            result.CreatedAt,
            result.StartedAt,
            result.FinishedAt);

    private static JobQueueCountDto ToContract(JobQueueCountResult result) =>
        new(result.Type, result.Status, result.Count);

    public static SettingsUpdate ToApplication(this SettingsUpdateRequest request) =>
        new(request.HideNsfw, request.EnableCastControls);

    public static SettingsResponse ToContract(this SettingsResult result) =>
        new(result.HideNsfw, result.EnableCastControls);

    public static LibrarySettingsUpdate ToApplication(this LibrarySettingsUpdateRequest request) =>
        new(
            request.AutoScanEnabled,
            request.ScanIntervalMinutes,
            request.AutoGenerateMetadata,
            request.AutoGenerateFingerprints,
            request.GeneratePhash,
            request.AutoGeneratePreview,
            request.GenerateTrickplay,
            request.TrickplayIntervalSeconds,
            request.PreviewClipDurationSeconds,
            request.ThumbnailQuality,
            request.TrickplayQuality,
            request.BackgroundWorkerConcurrency,
            request.NsfwLanAutoEnable,
            request.MetadataStorageDedicated,
            request.SubtitlesAutoEnable,
            request.SubtitlesPreferredLanguages,
            request.AudioPreferredLanguages,
            request.SubtitleStyle,
            request.SubtitleFontScale,
            request.SubtitlePositionPercent,
            request.SubtitleOpacity,
            request.DefaultPlaybackMode,
            request.ShowCastControls,
            request.HlsTranscoderProfile,
            request.HlsFfmpegPath,
            request.HlsVaapiDevice);

    public static LibraryRootCreate ToApplication(this LibraryRootCreateRequest request) =>
        new(
            request.Path,
            request.Label,
            request.Enabled,
            request.Recursive,
            request.ScanVideos,
            request.ScanImages,
            request.ScanAudio,
            request.ScanBooks,
            request.IsNsfw);

    public static LibraryRootUpdate ToApplication(this LibraryRootUpdateRequest request) =>
        new(
            request.Path,
            request.Label,
            request.Enabled,
            request.Recursive,
            request.ScanVideos,
            request.ScanImages,
            request.ScanAudio,
            request.ScanBooks,
            request.IsNsfw);

    public static LibraryConfigResponse ToContract(this LibraryConfigResult result) =>
        new(result.Settings.ToContract(), result.Roots.Select(ToContract).ToArray());

    public static LibrarySettings ToContract(this LibrarySettingsResult result) =>
        new(
            result.Id,
            result.AutoScanEnabled,
            result.ScanIntervalMinutes,
            result.AutoGenerateMetadata,
            result.AutoGenerateFingerprints,
            result.GeneratePhash,
            result.AutoGeneratePreview,
            result.GenerateTrickplay,
            result.TrickplayIntervalSeconds,
            result.PreviewClipDurationSeconds,
            result.ThumbnailQuality,
            result.TrickplayQuality,
            result.BackgroundWorkerConcurrency,
            result.NsfwLanAutoEnable,
            result.MetadataStorageDedicated,
            result.SubtitlesAutoEnable,
            result.SubtitlesPreferredLanguages,
            result.AudioPreferredLanguages,
            result.SubtitleStyle,
            result.SubtitleFontScale,
            result.SubtitlePositionPercent,
            result.SubtitleOpacity,
            result.DefaultPlaybackMode,
            result.ShowCastControls,
            result.HlsTranscoderProfile,
            result.HlsFfmpegPath,
            result.HlsVaapiDevice,
            result.CreatedAt,
            result.UpdatedAt);

    public static LibraryRoot ToContract(this LibraryRootResult result) =>
        new(
            result.Id,
            result.Path,
            result.Label,
            result.Enabled,
            result.Recursive,
            result.ScanVideos,
            result.ScanImages,
            result.ScanAudio,
            result.ScanBooks,
            result.IsNsfw,
            result.LastScannedAt,
            result.CreatedAt,
            result.UpdatedAt);

    public static LibraryBrowseResponse ToContract(this LibraryBrowseResult result) =>
        new(result.Path, result.ParentPath, result.Directories.Select(ToContract).ToArray());

    private static LibraryBrowseEntry ToContract(LibraryBrowseEntryResult result) =>
        new(result.Name, result.Path);

    public static PlaybackInfoQuery ToApplication(this PlaybackInfoRequest request) =>
        new()
        {
            UserId = request.UserId,
            StartTimeTicks = request.StartTimeTicks,
            AudioStreamIndex = request.AudioStreamIndex,
            SubtitleStreamIndex = request.SubtitleStreamIndex,
            MaxStreamingBitrate = request.MaxStreamingBitrate,
            EnableDirectPlay = request.EnableDirectPlay,
            EnableDirectStream = request.EnableDirectStream,
            EnableTranscoding = request.EnableTranscoding,
            MediaSourceId = request.MediaSourceId,
            PlaySessionId = request.PlaySessionId
        };

    public static PlaybackSessionCommand ToApplication(this PlaybackSessionRequest request) =>
        new()
        {
            ItemId = request.ItemId,
            MediaSourceId = request.MediaSourceId,
            PlaySessionId = request.PlaySessionId,
            PositionTicks = request.PositionTicks,
            IsPaused = request.IsPaused,
            IsMuted = request.IsMuted
        };

    public static PlaybackInfoResponse ToContract(this PlaybackInfoResult result) =>
        new(result.PlaySessionId, result.MediaSources.Select(ToContract).ToArray(), result.ErrorCode);

    private static MediaSourceInfo ToContract(MediaSourceInfoResult result) =>
        new(
            result.Id,
            result.Path,
            result.Protocol,
            result.Container,
            result.Size,
            result.Name,
            result.RunTimeTicks,
            result.SupportsDirectPlay,
            result.SupportsDirectStream,
            result.SupportsTranscoding,
            result.TranscodingUrl,
            result.TranscodingSubProtocol,
            result.TranscodingContainer,
            result.MediaStreams.Select(ToContract).ToArray(),
            result.TranscodingInfo?.ToContract());

    private static MediaStreamInfo ToContract(MediaStreamInfoResult result) =>
        new(
            result.Index,
            result.Type,
            result.Codec,
            result.Language,
            result.DisplayTitle,
            result.Width,
            result.Height,
            result.AverageFrameRate,
            result.BitRate,
            result.SampleRate,
            result.Channels,
            result.IsDefault,
            result.IsForced);

    private static TranscodingInfo ToContract(this TranscodingInfoResult result) =>
        new(
            result.Container,
            result.VideoCodec,
            result.AudioCodec,
            result.Protocol,
            result.IsVideoDirect,
            result.IsAudioDirect);

    public static UserItemData ToContract(this UserItemDataResult result) =>
        new(result.Played, result.PlayCount, result.PlaybackPositionTicks);

    public static OrganizePlanQuery ToApplication(this OrganizePlanRequest request) =>
        new(request.EntityId, request.RootId);

    public static OrganizePlanResponse ToContract(this OrganizePlanResult result) =>
        new(result.Items.Select(ToContract).ToArray());

    public static OrganizeApplyResponse ToContract(this OrganizeApplyResult result) =>
        new(result.Items.Select(ToContract).ToArray(), result.Applied, result.Skipped);

    private static OrganizePlanItem ToContract(OrganizePlanItemResult result) =>
        new(
            result.EntityId,
            result.Kind,
            result.Title,
            result.StorageShape,
            result.SourcePath,
            result.TargetPath,
            result.Status,
            result.Reason);
}

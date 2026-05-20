using Obscura.Application.Videos;
using Obscura.Contracts.Playback;

namespace Obscura.Api.Mapping;

internal static class ApplicationContractMapping {
    public static PlaybackInfoQuery ToApplication(this PlaybackInfoRequest request) =>
        new() {
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
        new() {
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

}

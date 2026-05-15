using Obscura.Application.Videos;
using Obscura.Contracts.Playback;
using Obscura.Infrastructure.Videos;

namespace Obscura.Infrastructure.Tests;

public sealed class PlaybackInfoServiceTests
{
    [Fact]
    public async Task PlaybackInfoExposesAllAudioStreamsAndSelectsRequestedTrack()
    {
        var videoId = Guid.Parse("12121212-1212-1212-1212-121212121212");
        var service = new PlaybackInfoService(
            new FakeVideoSourceService(new VideoSourceFile(
                videoId,
                "/media/movie.mkv",
                "video/x-matroska",
                false,
                DurationSeconds: 60,
                Width: 1920,
                Height: 1080,
                Streams:
                [
                    new(0, "Video", "h264", null, "Video", 1920, 1080, 24, null, null, null, true, false),
                    new(1, "Audio", "aac", "spa", "Spanish", null, null, null, null, 48000, 2, false, false),
                    new(2, "Audio", "aac", "eng", "English", null, null, null, null, 48000, 2, true, false)
                ])),
            new TranscodeSessionService());

        var info = await service.GetPlaybackInfoAsync(videoId, new PlaybackInfoRequest
        {
            AudioStreamIndex = 1,
            EnableDirectPlay = true,
            EnableDirectStream = true,
            EnableTranscoding = true
        }, CancellationToken.None);

        Assert.NotNull(info);
        var source = Assert.Single(info.MediaSources);
        Assert.Contains("AudioStreamIndex=1", source.TranscodingUrl);
        var audioStreams = source.MediaStreams.Where(stream => stream.Type == "Audio").ToList();
        Assert.Equal(2, audioStreams.Count);
        Assert.True(audioStreams.Single(stream => stream.Index == 1).IsDefault);
        Assert.False(audioStreams.Single(stream => stream.Index == 2).IsDefault);
    }

    private sealed class FakeVideoSourceService : IVideoSourceService
    {
        private readonly VideoSourceFile _source;

        public FakeVideoSourceService(VideoSourceFile source)
        {
            _source = source;
        }

        public Task<VideoSourceFile?> GetSourceAsync(Guid id, CancellationToken cancellationToken) =>
            Task.FromResult(id == _source.EntityId ? _source : null);
    }
}

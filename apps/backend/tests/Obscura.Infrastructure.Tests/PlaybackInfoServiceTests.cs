using Obscura.Application.Videos;
using Obscura.Contracts.Playback;
using Obscura.Contracts.Settings;
using Obscura.Infrastructure.Videos;
using Obscura.Application.Settings;

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

    [Fact]
    public async Task PlaybackInfoSelectsPreferredAudioLanguageBeforeContainerDefault()
    {
        var videoId = Guid.Parse("34343434-3434-3434-3434-343434343434");
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
                    new(1, "Audio", "aac", "spa", "Spanish", null, null, null, null, 48000, 2, true, false),
                    new(2, "Audio", "aac", null, "English - Stereo", null, null, null, null, 48000, 2, false, false)
                ])),
            new TranscodeSessionService(),
            new FakeSettingsService("en,eng,en-US"));

        var info = await service.GetPlaybackInfoAsync(videoId, new PlaybackInfoRequest
        {
            EnableDirectPlay = true,
            EnableDirectStream = true,
            EnableTranscoding = true
        }, CancellationToken.None);

        Assert.NotNull(info);
        var source = Assert.Single(info.MediaSources);
        Assert.Contains("AudioStreamIndex=2", source.TranscodingUrl);
        var audioStreams = source.MediaStreams.Where(stream => stream.Type == "Audio").ToList();
        Assert.False(audioStreams.Single(stream => stream.Index == 1).IsDefault);
        Assert.True(audioStreams.Single(stream => stream.Index == 2).IsDefault);
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

    private sealed class FakeSettingsService : ISettingsService
    {
        private readonly string _audioPreferredLanguages;

        public FakeSettingsService(string audioPreferredLanguages)
        {
            _audioPreferredLanguages = audioPreferredLanguages;
        }

        public Task<SettingsResponse> GetAsync(CancellationToken cancellationToken) =>
            Task.FromResult(new SettingsResponse(false, true));

        public Task<SettingsResponse> UpdateAsync(SettingsUpdateRequest request, CancellationToken cancellationToken) =>
            Task.FromResult(new SettingsResponse(request.HideNsfw ?? false, request.EnableCastControls ?? true));

        public Task<LibraryConfigResponse> GetLibraryConfigAsync(CancellationToken cancellationToken) =>
            Task.FromResult(new LibraryConfigResponse(SampleSettings(), []));

        public Task<LibrarySettings> UpdateLibrarySettingsAsync(
            LibrarySettingsUpdateRequest request,
            CancellationToken cancellationToken) =>
            Task.FromResult(SampleSettings());

        public Task<LibraryBrowseResponse> BrowseLibraryPathAsync(string? path, CancellationToken cancellationToken) =>
            Task.FromResult(new LibraryBrowseResponse(path ?? "/media", "/", []));

        public Task<LibraryRoot> CreateLibraryRootAsync(
            LibraryRootCreateRequest request,
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<LibraryRoot?> UpdateLibraryRootAsync(
            Guid id,
            LibraryRootUpdateRequest request,
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<bool> DeleteLibraryRootAsync(Guid id, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        private LibrarySettings SampleSettings() =>
            new(
                Guid.Parse("56565656-5656-5656-5656-565656565656"),
                false,
                60,
                true,
                true,
                false,
                true,
                true,
                10,
                8,
                2,
                2,
                1,
                false,
                true,
                false,
                "en,eng",
                _audioPreferredLanguages,
                "stylized",
                1,
                88,
                1,
                "direct",
                true,
                DateTimeOffset.UnixEpoch,
                DateTimeOffset.UnixEpoch);
    }
}

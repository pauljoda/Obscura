using Obscura.Infrastructure.Media;
using Obscura.Infrastructure.Processes;

namespace Obscura.Infrastructure.Tests;

public sealed class MediaToolServiceTests
{
    [Fact]
    public async Task CheckReportsAvailableFfmpegAndFfprobeVersions()
    {
        var service = new MediaToolService(new FakeProcessExecutor(new Dictionary<string, ProcessExecutionResult>
        {
            ["ffmpeg"] = new(0, "ffmpeg version 7.1\nbuilt with clang", ""),
            ["ffprobe"] = new(0, "ffprobe version 7.1\nbuilt with clang", "")
        }));

        var status = await service.CheckAsync(CancellationToken.None);

        Assert.True(status.FfmpegAvailable);
        Assert.True(status.FfprobeAvailable);
        Assert.Equal("ffmpeg version 7.1", status.FfmpegVersion);
        Assert.Equal("ffprobe version 7.1", status.FfprobeVersion);
    }

    [Fact]
    public async Task CheckHandlesMissingTools()
    {
        var service = new MediaToolService(new ThrowingProcessExecutor());

        var status = await service.CheckAsync(CancellationToken.None);

        Assert.False(status.FfmpegAvailable);
        Assert.False(status.FfprobeAvailable);
        Assert.Null(status.FfmpegVersion);
        Assert.Null(status.FfprobeVersion);
    }

    private sealed class FakeProcessExecutor : IProcessExecutor
    {
        private readonly IReadOnlyDictionary<string, ProcessExecutionResult> _results;

        public FakeProcessExecutor(IReadOnlyDictionary<string, ProcessExecutionResult> results)
        {
            _results = results;
        }

        public Task<ProcessExecutionResult> RunAsync(
            string fileName,
            IReadOnlyList<string> arguments,
            IReadOnlyDictionary<string, string>? environment,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(_results[fileName]);
        }
    }

    private sealed class ThrowingProcessExecutor : IProcessExecutor
    {
        public Task<ProcessExecutionResult> RunAsync(
            string fileName,
            IReadOnlyList<string> arguments,
            IReadOnlyDictionary<string, string>? environment,
            CancellationToken cancellationToken)
        {
            throw new FileNotFoundException(fileName);
        }
    }
}

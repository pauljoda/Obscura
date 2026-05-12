using Obscura.Infrastructure.Processes;

namespace Obscura.Infrastructure.Media;

public sealed class MediaToolService : IMediaToolService
{
    private readonly IProcessExecutor _processExecutor;

    public MediaToolService(IProcessExecutor processExecutor)
    {
        _processExecutor = processExecutor;
    }

    public async Task<MediaToolStatus> CheckAsync(CancellationToken cancellationToken)
    {
        var ffmpeg = await CheckToolAsync("ffmpeg", cancellationToken);
        var ffprobe = await CheckToolAsync("ffprobe", cancellationToken);

        return new MediaToolStatus(
            ffmpeg.Available,
            ffprobe.Available,
            ffmpeg.Version,
            ffprobe.Version);
    }

    private async Task<(bool Available, string? Version)> CheckToolAsync(
        string fileName,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _processExecutor.RunAsync(
                fileName,
                ["-version"],
                null,
                cancellationToken);
            var firstLine = result.StandardOutput
                .Split('\n', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
                .FirstOrDefault();

            return (result.ExitCode == 0, firstLine);
        }
        catch
        {
            return (false, null);
        }
    }
}

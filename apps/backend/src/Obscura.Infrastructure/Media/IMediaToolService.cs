namespace Obscura.Infrastructure.Media;

public interface IMediaToolService
{
    Task<MediaToolStatus> CheckAsync(CancellationToken cancellationToken);
}

public sealed record MediaToolStatus(
    bool FfmpegAvailable,
    bool FfprobeAvailable,
    string? FfmpegVersion,
    string? FfprobeVersion);

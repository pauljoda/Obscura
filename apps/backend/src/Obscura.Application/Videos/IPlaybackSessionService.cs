namespace Obscura.Application.Videos;

/// <summary>
/// Records Jellyfin-compatible playback session events and mirrors progress into Obscura resume state.
/// </summary>
public interface IPlaybackSessionService
{
    Task StartAsync(PlaybackSessionCommand request, CancellationToken cancellationToken);

    Task ProgressAsync(PlaybackSessionCommand request, CancellationToken cancellationToken);

    Task PingAsync(PlaybackSessionCommand request, CancellationToken cancellationToken);

    Task StopAsync(PlaybackSessionCommand request, CancellationToken cancellationToken);

    Task<UserItemDataResult?> MarkPlayedAsync(Guid itemId, CancellationToken cancellationToken);

    Task<UserItemDataResult?> MarkUnplayedAsync(Guid itemId, CancellationToken cancellationToken);
}

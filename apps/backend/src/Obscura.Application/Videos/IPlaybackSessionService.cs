using Obscura.Contracts.Playback;

namespace Obscura.Application.Videos;

/// <summary>
/// Records Jellyfin-compatible playback session events and mirrors progress into Obscura resume state.
/// </summary>
public interface IPlaybackSessionService
{
    Task StartAsync(PlaybackSessionRequest request, CancellationToken cancellationToken);

    Task ProgressAsync(PlaybackSessionRequest request, CancellationToken cancellationToken);

    Task PingAsync(PlaybackSessionRequest request, CancellationToken cancellationToken);

    Task StopAsync(PlaybackSessionRequest request, CancellationToken cancellationToken);

    Task<UserItemData?> MarkPlayedAsync(Guid itemId, CancellationToken cancellationToken);

    Task<UserItemData?> MarkUnplayedAsync(Guid itemId, CancellationToken cancellationToken);
}

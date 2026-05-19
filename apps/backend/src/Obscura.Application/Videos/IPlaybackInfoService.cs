namespace Obscura.Application.Videos;

/// <summary>
/// Negotiates Jellyfin-shaped playback capabilities for a media item before streaming starts.
/// </summary>
public interface IPlaybackInfoService
{
    /// <summary>
    /// Builds a playback response for one media item and client request.
    /// </summary>
    /// <param name="itemId">Media item identifier.</param>
    /// <param name="request">Optional client playback constraints.</param>
    /// <param name="cancellationToken">Token used to cancel negotiation.</param>
    /// <returns>Playable media source information, or null when the item cannot be found.</returns>
    Task<PlaybackInfoResult?> GetPlaybackInfoAsync(
        Guid itemId,
        PlaybackInfoQuery? request,
        CancellationToken cancellationToken);
}

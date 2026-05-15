using Obscura.Application.Videos;
using Obscura.Contracts.Playback;
using Obscura.Domain.Interfaces;

namespace Obscura.Infrastructure.Videos;

/// <summary>
/// Persists Jellyfin-compatible playback events into Obscura's shared playback capability.
/// </summary>
public sealed class PlaybackSessionService : IPlaybackSessionService
{
    private readonly IRatingService _ratings;
    private readonly ITranscodeSessionService _transcodes;

    public PlaybackSessionService(IRatingService ratings, ITranscodeSessionService transcodes)
    {
        _ratings = ratings;
        _transcodes = transcodes;
    }

    public Task StartAsync(PlaybackSessionRequest request, CancellationToken cancellationToken)
    {
        RegisterOrPing(request);
        return Task.CompletedTask;
    }

    public async Task ProgressAsync(PlaybackSessionRequest request, CancellationToken cancellationToken)
    {
        RegisterOrPing(request);
        if (request.ItemId != Guid.Empty && request.PositionTicks is >= 0)
        {
            await _ratings.UpdatePlaybackAsync(
                request.ItemId,
                ToSeconds(request.PositionTicks.Value),
                null,
                completed: false,
                cancellationToken);
        }
    }

    public Task PingAsync(PlaybackSessionRequest request, CancellationToken cancellationToken)
    {
        RegisterOrPing(request);
        return Task.CompletedTask;
    }

    public async Task StopAsync(PlaybackSessionRequest request, CancellationToken cancellationToken)
    {
        if (request.ItemId != Guid.Empty)
        {
            await _ratings.UpdatePlaybackAsync(
                request.ItemId,
                request.PositionTicks is >= 0 ? ToSeconds(request.PositionTicks.Value) : null,
                null,
                completed: false,
                cancellationToken);
        }

        if (!string.IsNullOrWhiteSpace(request.PlaySessionId))
        {
            await _transcodes.CancelAsync(request.PlaySessionId!, cancellationToken);
        }
    }

    public async Task<UserItemData?> MarkPlayedAsync(Guid itemId, CancellationToken cancellationToken)
    {
        var entity = await _ratings.UpdatePlaybackAsync(itemId, 0, null, completed: true, cancellationToken);
        return entity is null ? null : new UserItemData(Played: true, PlaybackPositionTicks: 0);
    }

    public async Task<UserItemData?> MarkUnplayedAsync(Guid itemId, CancellationToken cancellationToken)
    {
        var entity = await _ratings.UpdatePlaybackAsync(itemId, 0, null, completed: false, cancellationToken);
        return entity is null ? null : new UserItemData(Played: false, PlaybackPositionTicks: 0);
    }

    private void RegisterOrPing(PlaybackSessionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.PlaySessionId))
        {
            return;
        }

        if (request.ItemId == Guid.Empty)
        {
            _transcodes.Ping(request.PlaySessionId!);
            return;
        }

        _transcodes.Register(request.PlaySessionId!, request.ItemId);
        _transcodes.Ping(request.PlaySessionId!);
    }

    private static double ToSeconds(long ticks) =>
        Math.Max(0, ticks / (double)TimeSpan.TicksPerSecond);
}

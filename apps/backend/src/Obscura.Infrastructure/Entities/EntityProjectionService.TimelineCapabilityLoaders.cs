using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;
using Obscura.Domain.Media;
using Obscura.Domain.Taxonomy;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities;

/// <summary>
/// Loads timeline capability rows such as playback, counters, markers, and subtitles.
/// </summary>
public sealed partial class EntityProjectionService
{
    private async Task<IReadOnlyDictionary<Guid, Playback>> LoadPlaybackAsync(
        IReadOnlyList<Guid> entityIds,
        CancellationToken cancellationToken)
    {
        return await _db.EntityPlayback
            .AsNoTracking()
            .Where(row => entityIds.Contains(row.EntityId))
            .ToDictionaryAsync(
                row => row.EntityId,
                row => new Playback(
                    row.PlayCount,
                    TimeSpan.FromSeconds(row.PlayDurationSeconds),
                    TimeSpan.FromSeconds(row.ResumeSeconds),
                    row.LastPlayedAt,
                    row.CompletedAt),
                cancellationToken);
    }

    private async Task<IReadOnlyDictionary<Guid, IReadOnlyList<EntityCounter>>> LoadCountersAsync(
        IReadOnlyList<Guid> entityIds,
        CancellationToken cancellationToken)
    {
        var rows = await _db.EntityCounters
            .AsNoTracking()
            .Where(row => entityIds.Contains(row.EntityId))
            .OrderBy(row => row.Code)
            .ToListAsync(cancellationToken);

        return rows
            .GroupBy(row => row.EntityId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<EntityCounter>)group
                    .Select(row => new EntityCounter(row.Code, row.Value))
                    .ToArray());
    }

    private async Task<IReadOnlyDictionary<Guid, IReadOnlyList<EntityMarker>>> LoadMarkersAsync(
        IReadOnlyList<Guid> entityIds,
        CancellationToken cancellationToken)
    {
        var rows = await _db.EntityMarkers
            .AsNoTracking()
            .Where(marker => entityIds.Contains(marker.EntityId))
            .OrderBy(marker => marker.Seconds)
            .ThenBy(marker => marker.Title)
            .ToListAsync(cancellationToken);

        return rows
            .GroupBy(row => row.EntityId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<EntityMarker>)group
                    .Select(marker => new EntityMarker(marker.Id, marker.Title, marker.Seconds, marker.EndSeconds))
                    .ToArray());
    }

    private async Task<IReadOnlyDictionary<Guid, IReadOnlyList<EntitySubtitle>>> LoadSubtitlesAsync(
        IReadOnlyList<Guid> entityIds,
        CancellationToken cancellationToken)
    {
        var rows = await _db.EntitySubtitles
            .AsNoTracking()
            .Where(subtitle => entityIds.Contains(subtitle.EntityId))
            .OrderByDescending(subtitle => subtitle.IsDefault)
            .ThenBy(subtitle => subtitle.Language)
            .ThenBy(subtitle => subtitle.Label)
            .ToListAsync(cancellationToken);

        return rows
            .GroupBy(row => row.EntityId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<EntitySubtitle>)group
                    .Select(subtitle => new EntitySubtitle(
                        subtitle.Id,
                        subtitle.Language,
                        subtitle.Label,
                        subtitle.Format,
                        subtitle.Source,
                        subtitle.StoragePath,
                        subtitle.SourceFormat,
                        subtitle.SourcePath,
                        subtitle.IsDefault))
                    .ToArray());
    }

    private async Task<IReadOnlyList<EntityMarker>> LoadMarkersAsync(
        Guid entityId,
        CancellationToken cancellationToken)
    {
        return await _db.EntityMarkers
            .AsNoTracking()
            .Where(marker => marker.EntityId == entityId)
            .OrderBy(marker => marker.Seconds)
            .ThenBy(marker => marker.Title)
            .Select(marker => new EntityMarker(
                marker.Id,
                marker.Title,
                marker.Seconds,
                marker.EndSeconds))
            .ToArrayAsync(cancellationToken);
    }

    private async Task<IReadOnlyList<EntitySubtitle>> LoadSubtitlesAsync(
        Guid entityId,
        CancellationToken cancellationToken)
    {
        return await _db.EntitySubtitles
            .AsNoTracking()
            .Where(subtitle => subtitle.EntityId == entityId)
            .OrderByDescending(subtitle => subtitle.IsDefault)
            .ThenBy(subtitle => subtitle.Language)
            .ThenBy(subtitle => subtitle.Label)
            .Select(subtitle => new EntitySubtitle(
                subtitle.Id,
                subtitle.Language,
                subtitle.Label,
                subtitle.Format,
                subtitle.Source,
                subtitle.StoragePath,
                subtitle.SourceFormat,
                subtitle.SourcePath,
                subtitle.IsDefault))
            .ToArrayAsync(cancellationToken);
    }
}

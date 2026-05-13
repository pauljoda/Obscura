using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;
using Obscura.Domain.Media;
using Obscura.Domain.Taxonomy;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities;

public sealed partial class EntityProjectionService
{
    private async Task<IReadOnlyDictionary<Guid, IReadOnlyList<EntityStat>>> LoadStatsAsync(
        IReadOnlyList<Guid> entityIds,
        CancellationToken cancellationToken)
    {
        var rows = await _db.EntityStats
            .AsNoTracking()
            .Where(row => entityIds.Contains(row.EntityId))
            .OrderBy(row => row.Code)
            .ToListAsync(cancellationToken);

        return rows
            .GroupBy(row => row.EntityId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<EntityStat>)group.Select(row => new EntityStat(row.Code, row.Value)).ToArray());
    }

    private async Task<IReadOnlyDictionary<Guid, IReadOnlyList<EntityDate>>> LoadDatesAsync(
        IReadOnlyList<Guid> entityIds,
        CancellationToken cancellationToken)
    {
        var rows = await _db.EntityDates
            .AsNoTracking()
            .Where(row => entityIds.Contains(row.EntityId))
            .OrderBy(row => row.Code)
            .ToListAsync(cancellationToken);

        return rows
            .GroupBy(row => row.EntityId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<EntityDate>)group
                    .Select(row => new EntityDate(row.Code, row.Value, row.SortableValue, row.Precision))
                    .ToArray());
    }

    private async Task<IReadOnlyDictionary<Guid, CapabilityTechnical>> LoadTechnicalAsync(
        IReadOnlyList<Guid> entityIds,
        CancellationToken cancellationToken)
    {
        return await _db.EntityTechnical
            .AsNoTracking()
            .Where(row => entityIds.Contains(row.EntityId))
            .ToDictionaryAsync(
                row => row.EntityId,
                row => new CapabilityTechnical(
                    row.DurationSeconds is null ? null : TimeSpan.FromSeconds(row.DurationSeconds.Value),
                    row.Width,
                    row.Height,
                    row.FrameRate,
                    row.BitRate,
                    row.SampleRate,
                    row.Channels,
                    row.Codec,
                    row.Container,
                    row.Format),
                cancellationToken);
    }

    private async Task<IReadOnlyDictionary<Guid, IReadOnlyList<EntitySource>>> LoadSourcesAsync(
        IReadOnlyList<Guid> entityIds,
        CancellationToken cancellationToken)
    {
        var rows = await _db.EntitySources
            .AsNoTracking()
            .Where(row => entityIds.Contains(row.EntityId))
            .OrderBy(row => row.Code)
            .ToListAsync(cancellationToken);

        return rows
            .GroupBy(row => row.EntityId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<EntitySource>)group.Select(row => new EntitySource(row.Code, row.Value)).ToArray());
    }

    private async Task<IReadOnlyDictionary<Guid, CapabilityProgress>> LoadProgressAsync(
        IReadOnlyList<Guid> entityIds,
        CancellationToken cancellationToken)
    {
        return await _db.EntityProgress
            .AsNoTracking()
            .Where(row => entityIds.Contains(row.EntityId))
            .ToDictionaryAsync(
                row => row.EntityId,
                row => new CapabilityProgress(
                    row.CurrentEntityId,
                    row.Unit,
                    row.Index,
                    row.Total,
                    row.Mode,
                    row.CompletedAt,
                    row.UpdatedAt),
                cancellationToken);
    }

    private async Task<IReadOnlyDictionary<Guid, IReadOnlyList<EntityPosition>>> LoadPositionsAsync(
        IReadOnlyList<Guid> entityIds,
        CancellationToken cancellationToken)
    {
        var rows = await _db.EntityPositions
            .AsNoTracking()
            .Where(row => entityIds.Contains(row.EntityId))
            .OrderBy(row => row.Code)
            .ToListAsync(cancellationToken);

        return rows
            .GroupBy(row => row.EntityId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<EntityPosition>)group
                    .Select(row => new EntityPosition(row.Code, row.Value, row.Label))
                    .ToArray());
    }

    private async Task<IReadOnlyDictionary<Guid, CapabilityClassification>> LoadClassificationsAsync(
        IReadOnlyList<Guid> entityIds,
        CancellationToken cancellationToken)
    {
        return await _db.EntityClassifications
            .AsNoTracking()
            .Where(row => entityIds.Contains(row.EntityId))
            .ToDictionaryAsync(
                row => row.EntityId,
                row => new CapabilityClassification(row.Value, row.System),
                cancellationToken);
    }
}

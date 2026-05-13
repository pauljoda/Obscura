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
    private static string? TryGetDescription(Entity entity) =>
        entity.TryGetCapability(CapabilityRegistry.Description, out var description)
            ? description.Value
            : null;

    private static Entity WithDescription(Entity entity, string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? entity
            : entity.WithCapability(CapabilityRegistry.Description, new CapabilityDescription(value));

    private static Entity WithClassification(Entity entity, string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? entity
            : entity.WithCapability(CapabilityRegistry.Classification, new CapabilityClassification(value));

    private static Entity WithTechnical(
        Entity entity,
        TimeSpan? duration,
        int? width,
        int? height,
        double? frameRate,
        int? bitRate,
        int? sampleRate,
        int? channels,
        string? codec,
        string? container,
        string? format)
    {
        if (duration is null &&
            width is null &&
            height is null &&
            frameRate is null &&
            bitRate is null &&
            sampleRate is null &&
            channels is null &&
            string.IsNullOrWhiteSpace(codec) &&
            string.IsNullOrWhiteSpace(container) &&
            string.IsNullOrWhiteSpace(format))
        {
            return entity;
        }

        return entity.WithCapability(
            CapabilityRegistry.Technical,
            new CapabilityTechnical(duration, width, height, frameRate, bitRate, sampleRate, channels, codec, container, format));
    }

    private static Entity WithStats(Entity entity, IReadOnlyList<EntityStat?> stats)
    {
        var values = stats.Where(stat => stat is not null).Select(stat => stat!).ToArray();
        return values.Length == 0
            ? entity
            : entity.WithCapability(CapabilityRegistry.Stats, new CapabilityStats(values));
    }

    private static Entity WithDates(Entity entity, IReadOnlyList<EntityDate?> dates)
    {
        var values = dates.Where(date => date is not null).Select(date => date!).ToArray();
        return values.Length == 0
            ? entity
            : entity.WithCapability(CapabilityRegistry.Dates, new CapabilityDates(values));
    }

    private static Entity WithSource(Entity entity, IReadOnlyList<EntitySource?> sources)
    {
        var values = sources.Where(source => source is not null).Select(source => source!).ToArray();
        return values.Length == 0
            ? entity
            : entity.WithCapability(CapabilityRegistry.Source, new CapabilitySource(values));
    }

    private static Entity WithPosition(Entity entity, IReadOnlyList<EntityPosition?> positions)
    {
        var values = positions.Where(position => position is not null).Select(position => position!).ToArray();
        return values.Length == 0
            ? entity
            : entity.WithCapability(CapabilityRegistry.Position, new CapabilityPosition(values));
    }

    private static EntityStat? StatValue(string code, int? value) =>
        value is null ? null : new EntityStat(code, Math.Max(0, value.Value));

    private static EntityDate? DateValue(string code, string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : new EntityDate(code, value);

    private static EntitySource? SourceValue(string code, string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : new EntitySource(code, value);

    private static EntityPosition? PositionValue(string code, int? value) =>
        value is null ? null : new EntityPosition(code, value.Value);

    private static IEntityKind ResolveKind(string code) => EntityKindRegistry.Require(code);

    private async Task<Entity?> GetEntityOfKindAsync(
        Guid id,
        IEntityKind kind,
        CancellationToken cancellationToken)
    {
        var entity = await GetAsync(id, cancellationToken);
        if (entity is null || !string.Equals(entity.Kind.Code, kind.Code, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return entity;
    }
}

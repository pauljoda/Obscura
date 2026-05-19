using EntityMarker = Obscura.Domain.Capabilities.EntityMarker;
using EntitySubtitle = Obscura.Domain.Capabilities.EntitySubtitle;
using EntityStat = Obscura.Domain.Capabilities.EntityStat;
using EntityDate = Obscura.Domain.Capabilities.EntityDate;
using EntitySource = Obscura.Domain.Capabilities.EntitySource;
using EntityPosition = Obscura.Domain.Capabilities.EntityPosition;

namespace Obscura.Contracts.Entities;

/// <summary>API-facing marker capability.</summary>
public sealed record MarkersCapability(IReadOnlyList<EntityMarker> Items) : EntityCapability;

/// <summary>API-facing subtitle capability.</summary>
public sealed record SubtitlesCapability(IReadOnlyList<EntitySubtitle> Items) : EntityCapability;

/// <summary>API-facing stored or derived statistic capability.</summary>
public sealed record StatsCapability(IReadOnlyList<EntityStat> Items) : EntityCapability;

/// <summary>API-facing named date capability.</summary>
public sealed record DatesCapability(IReadOnlyList<EntityDate> Items) : EntityCapability;

/// <summary>API-facing semantic lifetime capability.</summary>
public sealed record LifetimeCapability(EntityDate? Start, EntityDate? End, string? Label) : EntityCapability;

/// <summary>API-facing shared technical metadata capability.</summary>
public sealed record TechnicalCapability(
    TimeSpan? Duration,
    int? Width,
    int? Height,
    double? FrameRate,
    int? BitRate,
    int? SampleRate,
    int? Channels,
    string? Codec,
    string? Container,
    string? Format) : EntityCapability;

/// <summary>API-facing source provenance capability.</summary>
public sealed record SourceCapability(IReadOnlyList<EntitySource> Items) : EntityCapability;

/// <summary>API-facing non-time progress capability.</summary>
public sealed record ProgressCapability(
    Guid? CurrentEntityId,
    string Unit,
    int Index,
    int Total,
    string? Mode,
    DateTimeOffset? CompletedAt,
    DateTimeOffset? UpdatedAt) : EntityCapability;

/// <summary>API-facing structural position capability.</summary>
public sealed record PositionCapability(IReadOnlyList<EntityPosition> Items) : EntityCapability;

/// <summary>API-facing provider or user classification capability.</summary>
public sealed record ClassificationCapability(string? Value, string? System) : EntityCapability;

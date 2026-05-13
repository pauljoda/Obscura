namespace Obscura.Contracts.Entities;

/// <summary>API-facing marker attached to an entity.</summary>
public sealed record EntityMarker(Guid Id, string Title, double Seconds, double? EndSeconds);

/// <summary>API-facing subtitle or caption track attached to an entity.</summary>
public sealed record EntitySubtitle(
    Guid Id,
    string Language,
    string? Label,
    string Format,
    string Source,
    string StoragePath,
    string? SourceFormat,
    string? SourcePath,
    bool IsDefault);

/// <summary>API-facing named statistic attached to an entity.</summary>
public sealed record EntityStat(string Code, int Value);

/// <summary>API-facing named date attached to an entity.</summary>
public sealed record EntityDate(string Code, string Value, DateOnly? SortableValue, string? Precision);

/// <summary>API-facing source provenance value attached to an entity.</summary>
public sealed record EntitySource(string Code, string Value);

/// <summary>API-facing structural position value attached to an entity.</summary>
public sealed record EntityPosition(string Code, int Value, string? Label);

/// <summary>API-facing marker capability.</summary>
public sealed record MarkersCapability(IReadOnlyList<EntityMarker> Items) : EntityCapability;

/// <summary>API-facing subtitle capability.</summary>
public sealed record SubtitlesCapability(IReadOnlyList<EntitySubtitle> Items) : EntityCapability;

/// <summary>API-facing stored or derived statistic capability.</summary>
public sealed record StatsCapability(IReadOnlyList<EntityStat> Items) : EntityCapability;

/// <summary>API-facing named date capability.</summary>
public sealed record DatesCapability(IReadOnlyList<EntityDate> Items) : EntityCapability;

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

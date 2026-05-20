namespace Obscura.Contracts.Entities;

/// <summary>API-facing non-time progress capability.</summary>
[CapabilityKind("progress")]
public sealed record ProgressCapability(
    Guid? CurrentEntityId,
    string Unit,
    int Index,
    int Total,
    string? Mode,
    DateTimeOffset? CompletedAt,
    DateTimeOffset? UpdatedAt) : EntityCapability;

namespace Obscura.Domain.Capabilities;

/// <summary>
/// Non-time progress capability for page, chapter, and other unit-based reading flows.
/// </summary>
public sealed record CapabilityProgress(
    Guid? CurrentEntityId,
    string Unit,
    int Index,
    int Total,
    string? Mode,
    DateTimeOffset? CompletedAt,
    DateTimeOffset? UpdatedAt) : ICapability<CapabilityProgress>
{
    /// <inheritdoc />
    public static ICapabilityKind<CapabilityProgress> CapabilityKind { get; } = new CapabilityKind<CapabilityProgress>("progress", "Progress");

    /// <inheritdoc />
    public ICapabilityKind Kind => CapabilityKind;

    /// <summary>A reusable empty progress capability.</summary>
    public static CapabilityProgress Empty { get; } = new(null, "item", 0, 0, null, null, null);
}

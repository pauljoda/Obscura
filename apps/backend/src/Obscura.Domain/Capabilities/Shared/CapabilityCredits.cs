using Obscura.Domain.Entities;

namespace Obscura.Domain.Capabilities;

/// <summary>
/// Credits capability for an entity that supports people credits.
/// </summary>
/// <param name="People">Ordered references to credited people entities.</param>
public sealed record CapabilityCredits(IReadOnlyList<EntityReference> People) : ICapability<CapabilityCredits>
{
    /// <inheritdoc />
    public static ICapabilityKind<CapabilityCredits> CapabilityKind { get; } = new CapabilityKind<CapabilityCredits>("credits", "Credits");

    /// <inheritdoc />
    public ICapabilityKind Kind => CapabilityKind;

    /// <summary>A reusable empty credits capability.</summary>
    public static CapabilityCredits Empty { get; } = new([]);
}

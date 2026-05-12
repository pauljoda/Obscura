using Obscura.Domain.Entities;

namespace Obscura.Domain.Capabilities;

/// <summary>
/// Credits capability for an entity that supports people credits.
/// </summary>
/// <param name="People">Ordered references to credited people entities.</param>
public sealed record CapabilityCredits(IReadOnlyList<EntityReference> People) : ICapability
{
    public ICapabilityKind Kind => Obscura.Domain.Entities.Capabilities.Credits;

    /// <summary>A reusable empty credits capability.</summary>
    public static CapabilityCredits Empty { get; } = new([]);
}

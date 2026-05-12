namespace Obscura.Domain.Capabilities;

/// <summary>
/// Rating capability for an entity that supports user ratings.
/// </summary>
/// <param name="Value">Validated rating value, or null when the entity is unrated.</param>
public sealed record CapabilityRating(Rating? Value) : ICapability
{
    public ICapabilityKind Kind => CapabilityRegistry.Rating;
}

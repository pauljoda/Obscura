namespace Obscura.Domain.Capabilities;

/// <summary>
/// Marker capability for entities that expose timeline, page, or navigation markers.
/// </summary>
/// <param name="Items">Ordered marker list attached to the entity.</param>
public sealed record CapabilityMarkers(IReadOnlyList<EntityMarker> Items) : ICapability<CapabilityMarkers>
{
    /// <inheritdoc />
    public static ICapabilityKind<CapabilityMarkers> CapabilityKind { get; } = new CapabilityKind<CapabilityMarkers>("markers", "Markers");

    /// <inheritdoc />
    public ICapabilityKind Kind => CapabilityKind;

    /// <summary>A reusable empty marker capability.</summary>
    public static CapabilityMarkers Empty { get; } = new([]);
}

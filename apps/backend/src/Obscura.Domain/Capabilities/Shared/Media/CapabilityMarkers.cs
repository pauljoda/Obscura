namespace Obscura.Domain.Capabilities;

/// <summary>
/// Mutable marker capability for timeline, page, or navigation markers.
/// </summary>
public sealed class CapabilityMarkers : EntityCapability {
    public CapabilityMarkers(IReadOnlyList<EntityMarker>? items = null) {
        Items = items?.ToArray() ?? [];
    }

    public override CapabilityKind Kind => CapabilityKind.Markers;
    public IReadOnlyList<EntityMarker> Items { get; private set; }
}

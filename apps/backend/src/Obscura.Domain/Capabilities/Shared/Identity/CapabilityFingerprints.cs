namespace Obscura.Domain.Capabilities;

/// <summary>
/// Mutable fingerprint capability for entities that have stable hashes or perceptual fingerprints.
/// </summary>
public sealed class CapabilityFingerprints : EntityCapability {
    public CapabilityFingerprints(IReadOnlyList<EntityFingerprint>? items = null) {
        Items = items?.ToArray() ?? [];
    }

    public override CapabilityKind Kind => CapabilityKind.Fingerprints;
    public IReadOnlyList<EntityFingerprint> Items { get; private set; }
}

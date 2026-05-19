namespace Obscura.Domain.Capabilities;

/// <summary>Mutable fingerprint capability for stable hashes or perceptual fingerprints.</summary>
public sealed class CapabilityFingerprints(IReadOnlyList<EntityFingerprint>? items = null)
    : ItemsCapability<EntityFingerprint>(items);

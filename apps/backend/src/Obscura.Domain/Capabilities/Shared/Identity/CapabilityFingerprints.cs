namespace Obscura.Domain.Capabilities;

/// <summary>
/// Fingerprint capability for entities that have stable hashes or perceptual fingerprints.
/// </summary>
/// <param name="Items">Hash and fingerprint values associated with the entity.</param>
public sealed record CapabilityFingerprints(IReadOnlyList<EntityFingerprint> Items) : ICapability<CapabilityFingerprints>
{
    /// <inheritdoc />
    public static ICapabilityKind<CapabilityFingerprints> CapabilityKind { get; } = new CapabilityKind<CapabilityFingerprints>("fingerprints", "Fingerprints");

    /// <inheritdoc />
    public ICapabilityKind Kind => CapabilityKind;

    /// <summary>A reusable empty fingerprint capability.</summary>
    public static CapabilityFingerprints Empty { get; } = new([]);
}

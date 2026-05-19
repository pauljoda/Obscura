using EntityFingerprint = Obscura.Domain.Capabilities.CapabilityFingerprints.Item;

namespace Obscura.Contracts.Entities;

/// <summary>API-facing fingerprint capability.</summary>
/// <param name="Items">Hash and fingerprint values associated with the entity.</param>
public sealed record FingerprintsCapability(IReadOnlyList<EntityFingerprint> Items) : EntityCapability;

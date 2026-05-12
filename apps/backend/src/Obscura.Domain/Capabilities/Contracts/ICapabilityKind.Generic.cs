namespace Obscura.Domain.Capabilities;

/// <summary>
/// Typed capability kind contract that lets callers retrieve a capability without casts.
/// </summary>
/// <typeparam name="TCapability">Concrete capability value handled by this kind.</typeparam>
public interface ICapabilityKind<TCapability> : ICapabilityKind
    where TCapability : class, ICapability;

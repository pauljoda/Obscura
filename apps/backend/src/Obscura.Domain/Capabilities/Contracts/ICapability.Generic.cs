namespace Obscura.Domain.Capabilities;

/// <summary>
/// Typed capability contract for capability implementations that own their registry kind metadata.
/// </summary>
/// <typeparam name="TCapability">Concrete capability implementation type.</typeparam>
public interface ICapability<TCapability> : ICapability
    where TCapability : class, ICapability<TCapability>
{
    /// <summary>Stable capability kind registered for this capability implementation.</summary>
    static abstract ICapabilityKind<TCapability> CapabilityKind { get; }
}

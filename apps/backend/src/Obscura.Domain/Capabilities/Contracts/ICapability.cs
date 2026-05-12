namespace Obscura.Domain.Capabilities;

/// <summary>
/// Contract implemented by every reusable behavior that can be attached to a global entity.
/// </summary>
public interface ICapability
{
    /// <summary>Stable capability kind used for lookup and API projection.</summary>
    ICapabilityKind Kind { get; }
}

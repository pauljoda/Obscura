namespace Obscura.Domain.Capabilities;

/// <summary>
/// Code-defined capability kind implementation.
/// </summary>
/// <typeparam name="TCapability">Concrete capability value handled by this kind.</typeparam>
/// <param name="Code">Stable lowercase code used in API discriminators.</param>
/// <param name="DisplayName">Human-readable label for diagnostics and future UI surfaces.</param>
public sealed record CapabilityKind<TCapability>(string Code, string DisplayName)
    : ICapabilityKind<TCapability>
    where TCapability : class, ICapability
{
    public Type CapabilityType => typeof(TCapability);
}

namespace Obscura.Domain.Capabilities;

/// <summary>
/// Code-defined capability kind owned by a concrete capability implementation.
/// </summary>
/// <typeparam name="TCapability">Concrete capability value represented by this kind.</typeparam>
public sealed class CapabilityKind<TCapability> : ICapabilityKind<TCapability>
    where TCapability : class, ICapability
{
    /// <summary>
    /// Initializes a capability kind with stable API and diagnostic metadata.
    /// </summary>
    /// <param name="code">Stable lowercase code used in API discriminators.</param>
    /// <param name="displayName">Human-readable label for diagnostics and future UI surfaces.</param>
    public CapabilityKind(string code, string displayName)
    {
        Code = code;
        DisplayName = displayName;
    }

    /// <inheritdoc />
    public string Code { get; }

    /// <inheritdoc />
    public string DisplayName { get; }

    /// <inheritdoc />
    public Type CapabilityType => typeof(TCapability);
}

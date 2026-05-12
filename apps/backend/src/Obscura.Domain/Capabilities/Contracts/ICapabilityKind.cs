namespace Obscura.Domain.Capabilities;

/// <summary>
/// Non-generic capability kind contract for lookup paths that do not need the concrete value type.
/// </summary>
public interface ICapabilityKind
{
    /// <summary>Stable lowercase code used in API discriminators.</summary>
    string Code { get; }

    /// <summary>Human-readable label for diagnostics and future UI surfaces.</summary>
    string DisplayName { get; }

    /// <summary>Concrete capability type represented by this kind.</summary>
    Type CapabilityType { get; }
}

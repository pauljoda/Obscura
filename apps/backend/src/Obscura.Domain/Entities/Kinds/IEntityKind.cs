namespace Obscura.Domain.Entities;

/// <summary>
/// Contract implemented by every code-defined entity kind.
/// </summary>
public interface IEntityKind
{
    /// <summary>Stable code used in storage, URLs, and API filters.</summary>
    string Code { get; }

    /// <summary>Human-readable label for diagnostics and future UI surfaces.</summary>
    string DisplayName { get; }

    /// <summary>Broad category used to group behavior and browsing surfaces.</summary>
    EntityKindCategory Category { get; }
}

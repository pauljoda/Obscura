namespace Obscura.Domain.Entities;

using Obscura.Domain.Capabilities;

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

    /// <summary>Image or generated visual asset roles this kind can expose through the image capability.</summary>
    IReadOnlyList<EntityFileRole> ImageAssetRoles => [];

    /// <summary>Capability kinds this entity kind intentionally supports.</summary>
    IReadOnlyList<ICapabilityKind> SupportedCapabilities => [];
}

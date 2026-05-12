namespace Obscura.Domain.Entities;

/// <summary>
/// Contract implemented by every code-defined entity relationship.
/// </summary>
public interface IEntityRelationship
{
    /// <summary>Stable code stored in the hierarchy table.</summary>
    string Code { get; }

    /// <summary>Human-readable label for diagnostics and future UI surfaces.</summary>
    string DisplayName { get; }

    /// <summary>True when the relationship represents canonical parentage instead of loose membership.</summary>
    bool IsStructural { get; }

    /// <summary>Allowed hierarchy layers declared by this relationship.</summary>
    IReadOnlyList<HierarchyLayer> Layers { get; }
}

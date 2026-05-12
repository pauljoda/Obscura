namespace Obscura.Domain.Entities;

/// <summary>
/// Ordering policy for children inside a hierarchy layer.
/// </summary>
public enum HierarchyOrdering
{
    /// <summary>Children are ordered by the sort order stored on the hierarchy edge.</summary>
    SortOrder
}

/// <summary>
/// One allowed parent-to-child step inside a code-defined entity hierarchy.
/// </summary>
/// <param name="RootKind">Entity kind that owns the full hierarchy this layer participates in.</param>
/// <param name="ParentKind">Entity kind that may own or navigate to the child.</param>
/// <param name="ChildKind">Entity kind allowed under the parent.</param>
/// <param name="Relationship">Semantic relationship stored on the hierarchy edge.</param>
/// <param name="ChildMayHaveMultipleParents">True when the child can be reused under more than one parent for this relationship.</param>
/// <param name="Ordering">Ordering policy for children in this layer.</param>
public sealed record HierarchyLayer(
    IEntityKind RootKind,
    IEntityKind ParentKind,
    IEntityKind ChildKind,
    IEntityRelationship Relationship,
    bool ChildMayHaveMultipleParents,
    HierarchyOrdering Ordering);

/// <summary>
/// Code-defined structural hierarchy rooted at one entity kind.
/// </summary>
/// <param name="RootKind">Entity kind that starts the hierarchy.</param>
/// <param name="Layers">Allowed parent-child layers reachable from the root.</param>
public sealed record HierarchyDefinition(
    IEntityKind RootKind,
    IReadOnlyList<HierarchyLayer> Layers);

/// <summary>
/// Projected entity tree node with the edge metadata that connected it to its parent.
/// </summary>
/// <param name="Entity">Entity represented by this tree node.</param>
/// <param name="RelationshipToParent">Relationship from the parent, or null for the root node.</param>
/// <param name="SortOrder">Sort order stored on the relationship edge, or zero for the root node.</param>
/// <param name="Children">Ordered child nodes.</param>
public sealed record EntityHierarchyNode(
    Entity Entity,
    IEntityRelationship? RelationshipToParent,
    int SortOrder,
    IReadOnlyList<EntityHierarchyNode> Children);

/// <summary>
/// Projected hierarchy tree for one root entity.
/// </summary>
/// <param name="Definition">Hierarchy definition used to validate and traverse the tree.</param>
/// <param name="Root">Root node for the projected hierarchy.</param>
public sealed record EntityHierarchyTree(
    HierarchyDefinition Definition,
    EntityHierarchyNode Root);

/// <summary>
/// Registry of structural entity hierarchies supported by the v2 backend.
/// </summary>
public static class EntityHierarchyDefinitions
{
    private static readonly HierarchyDefinition[] Known = EntityRelationshipRegistry.Structural
        .SelectMany(relationship => relationship.Layers)
        .GroupBy(layer => layer.RootKind.Code, StringComparer.OrdinalIgnoreCase)
        .Select(group => new HierarchyDefinition(
            group.First().RootKind,
            group.OrderBy(layer => layer.ParentKind.Code, StringComparer.Ordinal)
                .ThenBy(layer => layer.ChildKind.Code, StringComparer.Ordinal)
                .ThenBy(layer => layer.Relationship.Code, StringComparer.Ordinal)
                .ToArray()))
        .OrderBy(definition => definition.RootKind.Code, StringComparer.Ordinal)
        .ToArray();

    private static readonly IReadOnlyDictionary<string, HierarchyDefinition> ByRootKind = Known.ToDictionary(
        definition => definition.RootKind.Code,
        StringComparer.OrdinalIgnoreCase);

    /// <summary>Hierarchy for video series, including season-grouped and flat episode lists.</summary>
    public static readonly HierarchyDefinition VideoSeries = Require(EntityKindRegistry.VideoSeries);

    /// <summary>Hierarchy for books, including volume-grouped and direct chapter lists.</summary>
    public static readonly HierarchyDefinition Book = Require(EntityKindRegistry.Book);

    /// <summary>Hierarchy for galleries and their nested galleries or image children.</summary>
    public static readonly HierarchyDefinition Gallery = Require(EntityKindRegistry.Gallery);

    /// <summary>Hierarchy for audio libraries and their nested libraries or track children.</summary>
    public static readonly HierarchyDefinition AudioLibrary = Require(EntityKindRegistry.AudioLibrary);

    /// <summary>Hierarchy for nested tag taxonomy.</summary>
    public static readonly HierarchyDefinition Tag = Require(EntityKindRegistry.Tag);

    /// <summary>Hierarchy for nested studio taxonomy.</summary>
    public static readonly HierarchyDefinition Studio = Require(EntityKindRegistry.Studio);

    /// <summary>
    /// Gets every known hierarchy definition in deterministic registry order.
    /// </summary>
    public static IReadOnlyList<HierarchyDefinition> All => Known;

    /// <summary>
    /// Looks up a hierarchy definition by root entity kind.
    /// </summary>
    /// <param name="rootKind">Root entity kind to resolve.</param>
    /// <param name="definition">The matched hierarchy definition when the method returns true.</param>
    /// <returns>True when the root kind owns a known hierarchy; otherwise false.</returns>
    public static bool TryGet(IEntityKind rootKind, out HierarchyDefinition definition) =>
        ByRootKind.TryGetValue(rootKind.Code, out definition!);

    /// <summary>
    /// Looks up a hierarchy definition and fails when the root kind is not structural.
    /// </summary>
    /// <param name="rootKind">Root entity kind to resolve.</param>
    /// <returns>The hierarchy definition for the supplied root kind.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the root kind has no hierarchy definition.</exception>
    public static HierarchyDefinition Require(IEntityKind rootKind)
    {
        if (TryGet(rootKind, out var definition))
        {
            return definition;
        }

        throw new InvalidOperationException($"Entity kind '{rootKind.Code}' does not have a hierarchy definition.");
    }

    /// <summary>
    /// Determines whether a parent kind can contain a child kind through the supplied relationship.
    /// </summary>
    /// <param name="parentKind">Parent entity kind.</param>
    /// <param name="childKind">Child entity kind.</param>
    /// <param name="relationship">Relationship between parent and child.</param>
    /// <returns>True when the layer is allowed by any registered structural hierarchy.</returns>
    public static bool IsAllowed(IEntityKind parentKind, IEntityKind childKind, IEntityRelationship relationship) =>
        Known.SelectMany(definition => definition.Layers).Any(layer =>
            string.Equals(layer.ParentKind.Code, parentKind.Code, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(layer.ChildKind.Code, childKind.Code, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(layer.Relationship.Code, relationship.Code, StringComparison.OrdinalIgnoreCase));

}

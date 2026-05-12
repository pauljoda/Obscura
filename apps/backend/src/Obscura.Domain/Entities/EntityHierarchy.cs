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
/// <param name="ParentKind">Entity kind that may own or navigate to the child.</param>
/// <param name="ChildKind">Entity kind allowed under the parent.</param>
/// <param name="Relationship">Semantic relationship stored on the hierarchy edge.</param>
/// <param name="ChildMayHaveMultipleParents">True when the child can be reused under more than one parent for this relationship.</param>
/// <param name="Ordering">Ordering policy for children in this layer.</param>
public sealed record HierarchyLayer(
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
    /// <summary>Hierarchy for video series, including season-grouped and flat episode lists.</summary>
    public static readonly HierarchyDefinition VideoSeries = new(
        IEntityKind.VideoSeries,
        [
            Layer(IEntityKind.VideoSeries, IEntityKind.VideoSeason, IEntityRelationship.Season),
            Layer(IEntityKind.VideoSeason, IEntityKind.Video, IEntityRelationship.Episode),
            Layer(IEntityKind.VideoSeries, IEntityKind.Video, IEntityRelationship.Episode)
        ]);

    /// <summary>Hierarchy for books, including volume-grouped and direct chapter lists.</summary>
    public static readonly HierarchyDefinition Book = new(
        IEntityKind.Book,
        [
            Layer(IEntityKind.Book, IEntityKind.BookVolume, IEntityRelationship.Volume),
            Layer(IEntityKind.BookVolume, IEntityKind.BookChapter, IEntityRelationship.Chapter),
            Layer(IEntityKind.Book, IEntityKind.BookChapter, IEntityRelationship.Chapter),
            Layer(IEntityKind.BookChapter, IEntityKind.BookPage, IEntityRelationship.Page)
        ]);

    /// <summary>Hierarchy for galleries and their nested galleries or image children.</summary>
    public static readonly HierarchyDefinition Gallery = new(
        IEntityKind.Gallery,
        [
            Layer(IEntityKind.Gallery, IEntityKind.Gallery, IEntityRelationship.NestedGallery),
            Layer(IEntityKind.Gallery, IEntityKind.Image, IEntityRelationship.GalleryImage)
        ]);

    /// <summary>Hierarchy for audio libraries and their nested libraries or track children.</summary>
    public static readonly HierarchyDefinition AudioLibrary = new(
        IEntityKind.AudioLibrary,
        [
            Layer(IEntityKind.AudioLibrary, IEntityKind.AudioLibrary, IEntityRelationship.NestedAudioLibrary),
            Layer(IEntityKind.AudioLibrary, IEntityKind.AudioTrack, IEntityRelationship.AudioTrack)
        ]);

    /// <summary>Hierarchy for nested tag taxonomy.</summary>
    public static readonly HierarchyDefinition Tag = new(
        IEntityKind.Tag,
        [
            Layer(IEntityKind.Tag, IEntityKind.Tag, IEntityRelationship.NestedTag)
        ]);

    /// <summary>Hierarchy for nested studio taxonomy.</summary>
    public static readonly HierarchyDefinition Studio = new(
        IEntityKind.Studio,
        [
            Layer(IEntityKind.Studio, IEntityKind.Studio, IEntityRelationship.NestedStudio)
        ]);

    private static readonly HierarchyDefinition[] Known =
    [
        VideoSeries,
        Book,
        Gallery,
        AudioLibrary,
        Tag,
        Studio
    ];

    private static readonly IReadOnlyDictionary<EntityKindCode, HierarchyDefinition> ByRootKind = Known.ToDictionary(
        definition => definition.RootKind.Value);

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
        ByRootKind.TryGetValue(rootKind.Value, out definition!);

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
            layer.ParentKind == parentKind &&
            layer.ChildKind == childKind &&
            layer.Relationship == relationship);

    private static HierarchyLayer Layer(
        IEntityKind parentKind,
        IEntityKind childKind,
        IEntityRelationship relationship) =>
        new(parentKind, childKind, relationship, false, HierarchyOrdering.SortOrder);
}

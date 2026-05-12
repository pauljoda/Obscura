using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Generic media aggregate for entity kinds whose domain behavior is simply an ordered set of linked child entities.
/// </summary>
/// <param name="Entity">Shared global entity root for the library, collection, gallery, album, or other grouping.</param>
/// <param name="Children">Child entities linked into the aggregate, already ordered by the relationship projection.</param>
/// <param name="RelationshipCode">Relationship code that produced the children, such as <c>collection-item</c>, <c>image</c>, or <c>audio-track</c>.</param>
/// <param name="ChildKindCode">Optional entity kind that the relationship is expected to contain; null means the grouping can contain mixed kinds.</param>
public sealed record EntityLibrary(
    Entity Entity,
    IReadOnlyList<Entity> Children,
    string RelationshipCode,
    string? ChildKindCode);

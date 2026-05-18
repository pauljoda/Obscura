using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Media;

/// <summary>
/// API-facing detail shape for a page-based book, comic, or manga entity.
/// </summary>
/// <param name="Id">Book entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Book title.</param>
/// <param name="ParentEntityId">Structural parent entity identifier, when this book is nested.</param>
/// <param name="Capabilities">Shared entity capabilities projected for the book.</param>
/// <param name="ChildrenByKind">Generic child groups keyed by entity kind.</param>
/// <param name="BookType">Book category code.</param>
/// <param name="CoverPageId">Selected cover page entity, when one is set.</param>
public sealed record BookDetail(
    Guid Id,
    string Kind,
    string Title,
    Guid? ParentEntityId,
    int? SortOrder,
    IReadOnlyList<EntityCapability> Capabilities,
    IReadOnlyList<EntityGroup> ChildrenByKind,
    IReadOnlyList<EntityGroup> Relationships,
    string BookType,
    Guid? CoverPageId);

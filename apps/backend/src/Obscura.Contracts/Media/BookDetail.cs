using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Media;

/// <summary>
/// API-facing detail shape for a page-based book, comic, or manga entity.
/// </summary>
/// <param name="Id">Book entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Book title.</param>
/// <param name="Capabilities">Shared entity capabilities projected for the book.</param>
/// <param name="BookType">Book category code.</param>
/// <param name="CoverPageId">Selected cover page entity, when one is set.</param>
public sealed record BookDetail(
    Guid Id,
    string Kind,
    string Title,
    IReadOnlyList<EntityCapability> Capabilities,
    string BookType,
    Guid? CoverPageId);

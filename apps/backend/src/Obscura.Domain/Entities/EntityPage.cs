namespace Obscura.Domain.Entities;

/// <summary>
/// Cursor-paged set of global entities returned by catalog-style queries.
/// </summary>
/// <param name="Items">Entities in the current page.</param>
/// <param name="NextCursor">Opaque cursor for the next page, or null when the result is complete.</param>
public sealed record EntityPage(
    IReadOnlyList<Entity> Items,
    string? NextCursor);

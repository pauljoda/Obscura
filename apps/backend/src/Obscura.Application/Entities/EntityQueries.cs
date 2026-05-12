namespace Obscura.Application.Entities;

/// <summary>
/// Use-case query for cursor-paged entity browsing.
/// </summary>
/// <param name="Kind">Optional entity kind code to restrict the list.</param>
/// <param name="Search">Optional title search text.</param>
/// <param name="Cursor">Optional opaque cursor returned by a previous page.</param>
public sealed record EntityListQuery(string? Kind, string? Search, string? Cursor);

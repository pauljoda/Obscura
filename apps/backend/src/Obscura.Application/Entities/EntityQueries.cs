using Obscura.Domain.Entities;

namespace Obscura.Application.Entities;

/// <summary>
/// Use-case query for cursor-paged entity browsing.
/// </summary>
/// <param name="Kind">Optional typed entity kind to restrict the list.</param>
/// <param name="Search">Optional title search text.</param>
/// <param name="Cursor">Optional opaque cursor returned by a previous page.</param>
/// <param name="HideNsfw">Client-driven NSFW visibility override. When null, the server-side setting applies.</param>
public sealed record EntityListQuery(IEntityKind? Kind, string? Search, string? Cursor, bool? HideNsfw = null);

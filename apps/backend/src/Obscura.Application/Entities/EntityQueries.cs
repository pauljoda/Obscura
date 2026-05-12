namespace Obscura.Application.Entities;

public sealed record EntityListQuery(string? Kind, string? Search, string? Cursor);

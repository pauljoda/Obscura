namespace Obscura.Domain.Entities;

public sealed record EntityPage(
    IReadOnlyList<Entity> Items,
    string? NextCursor);

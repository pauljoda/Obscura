namespace Obscura.Domain.Entities;

/// <summary>
/// Lightweight pointer to another entity used inside reusable capabilities such as credits and studios.
/// </summary>
/// <param name="Id">Referenced entity identifier.</param>
/// <param name="Kind">Referenced entity kind.</param>
/// <param name="Title">Referenced entity title for display.</param>
/// <param name="ThumbnailUrl">Resolved thumbnail image path for the referenced entity, or null when no image exists.</param>
public sealed record EntityReference(Guid Id, IEntityKind Kind, string Title, string? ThumbnailUrl = null);

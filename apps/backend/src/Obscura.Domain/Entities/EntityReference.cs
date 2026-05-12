namespace Obscura.Domain.Entities;

/// <summary>
/// Lightweight pointer to another entity used inside reusable capabilities such as credits and studios.
/// </summary>
/// <param name="Id">Referenced entity identifier.</param>
/// <param name="Kind">Referenced entity kind.</param>
/// <param name="Title">Referenced entity title for display.</param>
public sealed record EntityReference(Guid Id, IEntityKind Kind, string Title);

namespace Obscura.Domain.Entities;

public sealed record EntityReference(Guid Id, EntityKind Kind, string Title);

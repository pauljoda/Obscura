namespace Obscura.Contracts.Entities;

/// <summary>API-facing tag capability.</summary>
/// <param name="Values">Tag names attached to the entity.</param>
/// <param name="Items">Tag entity references attached to the entity.</param>
public sealed record TagsCapability(IReadOnlyList<string> Values, IReadOnlyList<EntityReference> Items) : EntityCapability;

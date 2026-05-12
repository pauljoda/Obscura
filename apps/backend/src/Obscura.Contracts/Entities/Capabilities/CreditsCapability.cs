namespace Obscura.Contracts.Entities;

/// <summary>API-facing credits capability.</summary>
/// <param name="People">Credited people associated with the entity.</param>
public sealed record CreditsCapability(IReadOnlyList<EntityReference> People) : EntityCapability;

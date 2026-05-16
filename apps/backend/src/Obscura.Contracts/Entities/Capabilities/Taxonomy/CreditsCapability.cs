namespace Obscura.Contracts.Entities;

/// <summary>API-facing credited person with relationship role metadata.</summary>
/// <param name="Person">Referenced person entity.</param>
/// <param name="Role">Credit role code such as person, cast, or crew.</param>
/// <param name="Character">Optional character, alias, or contribution label for the credit.</param>
public sealed record EntityCredit(EntityReference Person, string Role, string? Character);

/// <summary>API-facing credits capability.</summary>
/// <param name="Items">Credited people with role metadata.</param>
/// <param name="People">Compatibility list of credited people associated with the entity.</param>
public sealed record CreditsCapability(IReadOnlyList<EntityCredit> Items, IReadOnlyList<EntityReference> People) : EntityCapability;

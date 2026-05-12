using Obscura.Domain.Entities;

namespace Obscura.Domain.Capabilities;

/// <summary>
/// One credited person attached to an entity, preserving the role metadata stored on the relationship.
/// </summary>
/// <param name="Person">Referenced person entity.</param>
/// <param name="Role">Semantic role for the credited person.</param>
/// <param name="Character">Optional character, alias, or contribution label for the credit.</param>
public sealed record EntityCredit(EntityReference Person, EntityCreditRole Role, string? Character);

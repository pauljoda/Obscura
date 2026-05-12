namespace Obscura.Domain.Entities;

/// <summary>
/// Closed set of semantic roles a person can have for an entity credit.
/// </summary>
public enum EntityCreditRole
{
    /// <summary>Generic person credit; UI labels can translate this to actor, artist, author, or similar.</summary>
    Person
}

/// <summary>
/// Codec for entity credit role codes.
/// </summary>
public sealed class EntityCreditRoleCodec : EnumCodec<EntityCreditRole>
{
    public EntityCreditRoleCodec()
        : base(new Dictionary<EntityCreditRole, string>
        {
            [EntityCreditRole.Person] = "person"
        })
    {
    }
}

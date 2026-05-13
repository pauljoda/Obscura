using Obscura.Domain.Entities;

namespace Obscura.Domain.Capabilities;

/// <summary>
/// Credits capability for an entity that supports people credits.
/// </summary>
/// <param name="Items">Ordered credited people with role metadata.</param>
public sealed record CapabilityCredits(IReadOnlyList<EntityCredit> Items) : ICapability<CapabilityCredits>
{
    /// <summary>
    /// Creates a credits capability from person references when role metadata has not been loaded.
    /// </summary>
    /// <param name="people">Ordered references to credited people entities.</param>
    public CapabilityCredits(IReadOnlyList<EntityReference> people)
        : this(people.Select(person => new EntityCredit(person, EntityCreditRole.Person, null)).ToArray())
    {
    }

    /// <inheritdoc />
    public static ICapabilityKind<CapabilityCredits> CapabilityKind { get; } = new CapabilityKind<CapabilityCredits>("credits", "Credits");

    /// <inheritdoc />
    public ICapabilityKind Kind => CapabilityKind;

    /// <summary>Ordered references to credited people entities.</summary>
    public IReadOnlyList<EntityReference> People => Items.Select(item => item.Person).ToArray();

    /// <summary>A reusable empty credits capability.</summary>
    public static CapabilityCredits Empty { get; } = new(Array.Empty<EntityCredit>());
}

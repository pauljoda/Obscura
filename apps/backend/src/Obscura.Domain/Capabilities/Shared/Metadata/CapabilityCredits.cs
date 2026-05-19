using Obscura.Domain.Taxonomy;

namespace Obscura.Domain.Capabilities;

/// <summary>
/// Mutable list of people credited in the scope of the owning entity.
/// </summary>
public sealed class CapabilityCredits : EntityCapability {
    private readonly List<EntityCredit> _credits = [];

    /// <inheritdoc />

    /// <summary>Credits attached to the entity in insertion order.</summary>
    public IReadOnlyList<EntityCredit> Credits => _credits.ToArray();

    /// <summary>
    /// Adds a person credit in the scope of the owning entity.
    /// </summary>
    /// <param name="person">Referenced person entity.</param>
    /// <param name="role">Role the person had for this entity.</param>
    /// <param name="label">Optional scoped label, such as a character name.</param>
    /// <returns>The created credit entry.</returns>
    /// <exception cref="ArgumentException">Thrown when the same person, role, and label are already credited.</exception>
    public EntityCredit Add(Person person, CreditRole role, string? label = null) {
        ArgumentNullException.ThrowIfNull(person);
        if (_credits.Any(credit =>
                credit.Person.Id == person.Id &&
                credit.Role == role &&
                string.Equals(credit.Label, label, StringComparison.Ordinal))) {
            throw new ArgumentException($"Person '{person.Id}' already has a matching {role} credit.", nameof(person));
        }

        var credit = new EntityCredit(person, role, label);
        _credits.Add(credit);
        return credit;
    }

    /// <summary>
    /// Gets credits for a specific role.
    /// </summary>
    /// <param name="role">Credit role to retrieve.</param>
    /// <returns>Matching credits in insertion order.</returns>
    public IReadOnlyList<EntityCredit> ForRole(CreditRole role) =>
        _credits.Where(credit => credit.Role == role).ToArray();
}

/// <summary>
/// Closed set of person credit roles that can be attached to an entity.
/// </summary>
public enum CreditRole {
    /// <summary>Generic credit when a more specific role is not known.</summary>
    Person,

    /// <summary>Actor or performer credit.</summary>
    Actor,

    /// <summary>Director credit.</summary>
    Director,

    /// <summary>Writer credit.</summary>
    Writer,

    /// <summary>Producer credit.</summary>
    Producer,

    /// <summary>Creator credit.</summary>
    Creator,

    /// <summary>Artist credit.</summary>
    Artist,

    /// <summary>Narrator credit.</summary>
    Narrator,

    /// <summary>Composer credit.</summary>
    Composer
}

/// <summary>
/// Person credit scoped to one entity, including the role and optional display label for that scope.
/// </summary>
public sealed class EntityCredit {
    /// <summary>
    /// Creates a scoped person credit.
    /// </summary>
    /// <param name="person">Referenced person entity.</param>
    /// <param name="role">Role the person had for the entity.</param>
    /// <param name="label">Optional scoped label, such as a character name.</param>
    public EntityCredit(Person person, CreditRole role, string? label = null) {
        Person = person ?? throw new ArgumentNullException(nameof(person));
        Role = role;
        Label = label;
    }

    /// <summary>Referenced person entity.</summary>
    public Person Person { get; }

    /// <summary>Role the person had for the entity.</summary>
    public CreditRole Role { get; }

    /// <summary>Optional scoped label, such as a character name.</summary>
    public string? Label { get; }
}

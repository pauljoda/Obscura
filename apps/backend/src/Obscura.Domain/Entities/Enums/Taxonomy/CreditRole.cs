namespace Obscura.Domain.Entities;

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

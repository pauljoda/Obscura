using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Taxonomy;

/// <summary>
/// Domain model for a person taxonomy entity; UI contexts decide whether to label this as actor, artist, author, or another role.
/// </summary>
/// <param name="Id">Stable global entity identifier inherited from the root entity model.</param>
/// <param name="Title">Primary display name inherited from the root entity model.</param>
/// <param name="Subtitle">Optional secondary display text inherited from the root entity model.</param>
/// <param name="Capabilities">Shared ratings, tags, artwork, links, and flags attached to the person.</param>
/// <param name="Details">Person-specific descriptive metadata.</param>
public sealed record Person(
    Guid Id,
    string Title,
    string? Subtitle,
    EntityCapabilities Capabilities,
    PersonDetails Details)
    : Entity(Id, EntityKind.Person, Title, Subtitle, Capabilities)
{
    /// <summary>
    /// Returns a copy of the person with new person-specific metadata.
    /// </summary>
    /// <param name="details">Replacement person details.</param>
    /// <returns>A new person instance with unchanged shared entity fields and updated details.</returns>
    public Person WithDetails(PersonDetails details) => this with { Details = details };
}

/// <summary>
/// Person-specific metadata that should not live on every global entity.
/// </summary>
/// <param name="Disambiguation">Short qualifier used to distinguish people with the same display name.</param>
/// <param name="Gender">Optional provider/user-supplied gender text.</param>
/// <param name="Birthdate">Optional birthdate as provider/user-facing text.</param>
/// <param name="Country">Optional country or region text.</param>
/// <param name="Ethnicity">Optional ethnicity text.</param>
/// <param name="EyeColor">Optional eye color text.</param>
/// <param name="HairColor">Optional hair color text.</param>
/// <param name="Height">Optional height in centimeters.</param>
/// <param name="Weight">Optional weight in kilograms.</param>
/// <param name="Measurements">Optional measurements text.</param>
/// <param name="Tattoos">Optional tattoo notes.</param>
/// <param name="Piercings">Optional piercing notes.</param>
/// <param name="CareerStart">Optional first active year.</param>
/// <param name="CareerEnd">Optional final active year.</param>
/// <param name="Details">Freeform person description.</param>
public sealed record PersonDetails(
    string? Disambiguation,
    string? Gender,
    string? Birthdate,
    string? Country,
    string? Ethnicity,
    string? EyeColor,
    string? HairColor,
    int? Height,
    int? Weight,
    string? Measurements,
    string? Tattoos,
    string? Piercings,
    int? CareerStart,
    int? CareerEnd,
    string? Details)
{
    /// <summary>
    /// Empty person details used before provider or manual metadata is attached.
    /// </summary>
    public static PersonDetails Empty { get; } = new(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null);
}

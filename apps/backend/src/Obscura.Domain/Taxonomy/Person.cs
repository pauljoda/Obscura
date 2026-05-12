using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Taxonomy;

/// <summary>
/// Domain model for a person taxonomy entity; UI contexts decide whether to label this as actor, artist, author, or another role.
/// </summary>
/// <param name="Id">Shared global entity identifier.</param>
/// <param name="Title">Display title inherited from the shared entity root.</param>
/// <param name="Subtitle">Optional display subtitle inherited from the shared entity root.</param>
public sealed record Person(
    Guid Id,
    string Title,
    string? Subtitle,
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
    string? Description)
    : Entity(
        Id,
        EntityKindRegistry.Person,
        Title,
        Subtitle,
        [
            new CapabilityRating(null),
            CapabilityTags.Empty,
            CapabilityImages.Empty,
            CapabilityLinks.Empty,
            CapabilityFlags.Empty,
            CapabilityFiles.Empty
        ])
{
    /// <summary>
    /// Creates a person from an already hydrated entity root.
    /// </summary>
    public Person(
        Entity entity,
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
        string? Description)
        : this(
            entity.Id,
            entity.Title,
            entity.Subtitle,
            Disambiguation,
            Gender,
            Birthdate,
            Country,
            Ethnicity,
            EyeColor,
            HairColor,
            Height,
            Weight,
            Measurements,
            Tattoos,
            Piercings,
            CareerStart,
            CareerEnd,
            Description)
    {
        Capabilities = entity.Capabilities;
    }
}

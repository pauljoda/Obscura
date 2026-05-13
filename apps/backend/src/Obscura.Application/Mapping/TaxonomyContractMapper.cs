using Obscura.Contracts.Taxonomy;
using DomainPerson = Obscura.Domain.Taxonomy.Person;
using DomainStudio = Obscura.Domain.Taxonomy.Studio;
using DomainTag = Obscura.Domain.Taxonomy.Tag;

namespace Obscura.Application.Mapping;

/// <summary>
/// Contains taxonomy-specific detail contract mapping for v2 person, studio, and tag routes.
/// </summary>
public static partial class ContractMapper
{
    /// <summary>
    /// Converts a person aggregate into its object-specific detail contract.
    /// </summary>
    /// <param name="person">Domain person aggregate with person profile fields.</param>
    /// <returns>Person detail contract for API callers.</returns>
    public static PersonDetail ToPersonDetail(DomainPerson person) =>
        new(
            person.Id,
            person.Kind.Code,
            person.Title,
            ToEntityCapabilities(person.Capabilities),
            person.Disambiguation,
            person.Gender,
            person.Birthdate,
            person.Country,
            person.Ethnicity,
            person.EyeColor,
            person.HairColor,
            person.Height,
            person.Weight,
            person.Measurements,
            person.Tattoos,
            person.Piercings,
            person.CareerStart,
            person.CareerEnd);

    /// <summary>
    /// Converts a studio aggregate into its object-specific detail contract.
    /// </summary>
    /// <param name="studio">Domain studio aggregate with hierarchy metadata.</param>
    /// <returns>Studio detail contract for API callers.</returns>
    public static StudioDetail ToStudioDetail(DomainStudio studio) =>
        new(
            studio.Id,
            studio.Kind.Code,
            studio.Title,
            ToEntityCapabilities(studio.Capabilities),
            studio.ParentStudioId);

    /// <summary>
    /// Converts a tag aggregate into its object-specific detail contract.
    /// </summary>
    /// <param name="tag">Domain tag aggregate with hierarchy and automation metadata.</param>
    /// <returns>Tag detail contract for API callers.</returns>
    public static TagDetail ToTagDetail(DomainTag tag) =>
        new(
            tag.Id,
            tag.Kind.Code,
            tag.Title,
            ToEntityCapabilities(tag.Capabilities),
            tag.ParentTagId,
            tag.IgnoreAutoTag);
}

using Obscura.Contracts.Taxonomy;
using DomainPerson = Obscura.Domain.Taxonomy.Person;
using DomainStudio = Obscura.Domain.Taxonomy.Studio;
using DomainTag = Obscura.Domain.Taxonomy.Tag;

namespace Obscura.Api.Mapping;

public static partial class ContractMapper
{
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

    public static StudioDetail ToStudioDetail(DomainStudio studio) =>
        new(
            studio.Id,
            studio.Kind.Code,
            studio.Title,
            ToEntityCapabilities(studio.Capabilities),
            studio.ParentStudioId);

    public static TagDetail ToTagDetail(DomainTag tag) =>
        new(
            tag.Id,
            tag.Kind.Code,
            tag.Title,
            ToEntityCapabilities(tag.Capabilities),
            tag.ParentTagId,
            tag.IgnoreAutoTag);
}

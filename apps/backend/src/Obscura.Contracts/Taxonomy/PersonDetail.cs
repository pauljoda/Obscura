using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Taxonomy;

/// <summary>
/// API-facing detail shape for a person taxonomy entity.
/// </summary>
/// <param name="Id">Person entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Person display name.</param>
/// <param name="ParentEntityId">Structural parent entity identifier, when present.</param>
/// <param name="Capabilities">Shared entity capabilities projected for the person.</param>
/// <param name="ChildrenByKind">Generic child groups keyed by entity kind.</param>
/// <param name="Disambiguation">Optional text used to distinguish people with the same name.</param>
/// <param name="Gender">Optional gender value from imported or edited metadata.</param>
/// <param name="Birthdate">Optional birthdate value as supplied by metadata.</param>
/// <param name="Country">Optional country value.</param>
/// <param name="Ethnicity">Optional ethnicity value.</param>
/// <param name="EyeColor">Optional eye color value.</param>
/// <param name="HairColor">Optional hair color value.</param>
/// <param name="Height">Optional height value in centimeters when known.</param>
/// <param name="Weight">Optional weight value in kilograms when known.</param>
/// <param name="Measurements">Optional measurements text.</param>
/// <param name="Tattoos">Optional tattoo description.</param>
/// <param name="Piercings">Optional piercing description.</param>
/// <param name="CareerStart">Optional career start year.</param>
/// <param name="CareerEnd">Optional career end year.</param>
public sealed record PersonDetail(
    Guid Id,
    string Kind,
    string Title,
    Guid? ParentEntityId,
    int? SortOrder,
    IReadOnlyList<EntityCapability> Capabilities,
    IReadOnlyList<EntityGroup> ChildrenByKind,
    IReadOnlyList<EntityGroup> Relationships,
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
    int? CareerEnd);

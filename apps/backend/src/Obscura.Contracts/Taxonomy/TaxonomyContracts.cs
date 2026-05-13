using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Taxonomy;

/// <summary>
/// Cursor-paged response for taxonomy browsing routes.
/// </summary>
/// <param name="Items">Current page of taxonomy cards.</param>
/// <param name="NextCursor">Cursor for the next page, or null when complete.</param>
public sealed record TaxonomyListResponse(
    IReadOnlyList<EntityCard> Items,
    string? NextCursor);

/// <summary>
/// API-facing detail shape for taxonomy entities such as people, studios, and tags.
/// </summary>
/// <param name="Id">Taxonomy entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Taxonomy entity title.</param>
/// <param name="Capabilities">Shared entity capabilities projected for the taxonomy entity.</param>
/// <param name="Disambiguation">Optional person disambiguation text.</param>
/// <param name="Gender">Optional person gender value.</param>
/// <param name="Birthdate">Optional person birthdate value.</param>
/// <param name="Country">Optional person country value.</param>
/// <param name="Ethnicity">Optional person ethnicity value.</param>
/// <param name="EyeColor">Optional person eye color value.</param>
/// <param name="HairColor">Optional person hair color value.</param>
/// <param name="Height">Optional person height value.</param>
/// <param name="Weight">Optional person weight value.</param>
/// <param name="Measurements">Optional person measurements value.</param>
/// <param name="Tattoos">Optional person tattoos value.</param>
/// <param name="Piercings">Optional person piercings value.</param>
/// <param name="CareerStart">Optional person career start year.</param>
/// <param name="CareerEnd">Optional person career end year.</param>
/// <param name="ParentStudioId">Parent studio entity for studio hierarchies.</param>
/// <param name="ParentTagId">Parent tag entity for tag hierarchies.</param>
/// <param name="IgnoreAutoTag">Whether automatic tagging should ignore this tag.</param>
public sealed record TaxonomyDetail(
    Guid Id,
    string Kind,
    string Title,
    IReadOnlyList<EntityCapability> Capabilities,
    string? Disambiguation = null,
    string? Gender = null,
    string? Birthdate = null,
    string? Country = null,
    string? Ethnicity = null,
    string? EyeColor = null,
    string? HairColor = null,
    int? Height = null,
    int? Weight = null,
    string? Measurements = null,
    string? Tattoos = null,
    string? Piercings = null,
    int? CareerStart = null,
    int? CareerEnd = null,
    Guid? ParentStudioId = null,
    Guid? ParentTagId = null,
    bool? IgnoreAutoTag = null);

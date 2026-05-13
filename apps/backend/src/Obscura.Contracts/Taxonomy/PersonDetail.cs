using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Taxonomy;

/// <summary>
/// API-facing detail shape for a person taxonomy entity.
/// </summary>
public sealed record PersonDetail(
    Guid Id,
    string Kind,
    string Title,
    IReadOnlyList<EntityCapability> Capabilities,
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

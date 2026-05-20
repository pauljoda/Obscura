namespace Obscura.Contracts.Entities;

/// <summary>Credit metadata exposed by detail routes that need character or role labels.</summary>
/// <param name="PersonId">Referenced person entity identifier.</param>
/// <param name="Role">Provider or domain role code, when known.</param>
/// <param name="Character">Character, credit subtitle, or contribution label, when known.</param>
public sealed record EntityCreditMetadata(Guid PersonId, string? Role, string? Character);

/// <summary>
/// Shared shape implemented by every entity card and kind-specific detail contract.
/// Carries the fields common to all entities so detail routes can be returned as a single
/// strongly typed contract instead of <see cref="object"/>.
/// </summary>
public interface IEntityCard
{
    /// <summary>Global entity identifier.</summary>
    Guid Id { get; }

    /// <summary>Entity kind code.</summary>
    string Kind { get; }

    /// <summary>Primary display title.</summary>
    string Title { get; }

    /// <summary>Structural parent entity identifier, or null for root and virtual collection children.</summary>
    Guid? ParentEntityId { get; }

    /// <summary>Optional structural order under the parent entity.</summary>
    int? SortOrder { get; }

    /// <summary>Shared capabilities already projected for the card.</summary>
    IReadOnlyList<EntityCapability> Capabilities { get; }

    /// <summary>Generic child groups keyed by entity kind.</summary>
    IReadOnlyList<EntityGroup> ChildrenByKind { get; }

    /// <summary>Generic non-structural relationship groups keyed by entity kind.</summary>
    IReadOnlyList<EntityGroup> Relationships { get; }
}

/// <summary>
/// Normalized card/detail shape used across media, taxonomy, and collection routes.
/// </summary>
/// <param name="Id">Global entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Primary display title.</param>
/// <param name="ParentEntityId">Structural parent entity identifier, or null for root and virtual collection children.</param>
/// <param name="SortOrder">Optional structural order under the parent entity.</param>
/// <param name="Capabilities">Shared capabilities already projected for the card.</param>
/// <param name="ChildrenByKind">Generic child groups keyed by entity kind.</param>
/// <param name="Relationships">Generic non-structural relationship groups keyed by entity kind.</param>
public sealed record EntityCard(
    Guid Id,
    string Kind,
    string Title,
    Guid? ParentEntityId,
    int? SortOrder,
    IReadOnlyList<EntityCapability> Capabilities,
    IReadOnlyList<EntityGroup> ChildrenByKind,
    IReadOnlyList<EntityGroup> Relationships) : IEntityCard;

/// <summary>
/// Cursor-paged entity list response.
/// </summary>
/// <param name="Items">Current page of entity cards.</param>
/// <param name="NextCursor">Cursor for the next page, or null when complete.</param>
public sealed record EntityListResponse(
    IReadOnlyList<EntityThumbnail> Items,
    string? NextCursor);

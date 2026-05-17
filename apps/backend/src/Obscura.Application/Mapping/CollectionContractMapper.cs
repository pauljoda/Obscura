using Obscura.Contracts.Collections;
using Obscura.Domain.Entities;
using DomainCollection = Obscura.Domain.Media.Collection;

namespace Obscura.Application.Mapping;

/// <summary>
/// Contains collection-specific detail contract mapping for v2 collection routes.
/// </summary>
public static partial class ContractMapper
{
    /// <summary>
    /// Converts a typed collection aggregate into the collection detail contract.
    /// </summary>
    /// <param name="collection">Collection aggregate with collection settings and ordered member entities.</param>
    /// <returns>Collection detail contract with collection-specific fields.</returns>
    public static CollectionDetail ToCollectionDetail(DomainCollection collection) =>
        new(
            collection.Id,
            collection.Kind.Code,
            collection.Title,
            collection.ParentEntityId,
            collection.SortOrder,
            ToEntityCapabilities(collection.Capabilities),
            ToEntityChildGroups(collection.Items),
            ToEntityRelationshipGroups(collection.Relationships),
            collection.Mode.ToCode(),
            collection.RuleTreeJson,
            collection.CoverMode.ToCode(),
            collection.CoverItemId,
            collection.SlideshowDuration,
            collection.SlideshowAutoAdvance,
            collection.LastRefreshedAt);
}

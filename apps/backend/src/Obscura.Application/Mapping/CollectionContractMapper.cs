using Obscura.Contracts.Collections;
using Obscura.Domain.Entities;
using DomainCollection = Obscura.Domain.Media.Collection;
using DomainEntityLibrary = Obscura.Domain.Media.EntityLibrary;

namespace Obscura.Application.Mapping;

/// <summary>
/// Contains collection-specific detail contract mapping for v2 collection routes.
/// </summary>
public static partial class ContractMapper
{
    /// <summary>
    /// Converts a generic entity library aggregate into the collection detail contract.
    /// </summary>
    /// <param name="library">Domain aggregate containing the collection root and linked members.</param>
    /// <returns>Collection detail contract for API callers.</returns>
    public static CollectionDetail ToCollectionDetail(DomainEntityLibrary library) =>
        new(
            library.Entity.Id,
            library.Entity.Kind.Code,
            library.Entity.Title,
            ToEntityCapabilities(library.Entity.Capabilities),
            ToEntityCards(library.Children));

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
            ToEntityCapabilities(collection.Capabilities),
            ToEntityCards(collection.Items),
            collection.Mode.ToCode(),
            collection.RuleTreeJson,
            collection.CoverMode.ToCode(),
            collection.CoverItemId,
            collection.SlideshowDuration,
            collection.SlideshowAutoAdvance,
            collection.LastRefreshedAt);
}

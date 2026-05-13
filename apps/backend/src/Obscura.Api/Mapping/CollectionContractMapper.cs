using Obscura.Contracts.Collections;
using Obscura.Domain.Entities;
using DomainCollection = Obscura.Domain.Media.Collection;
using DomainEntityLibrary = Obscura.Domain.Media.EntityLibrary;

namespace Obscura.Api.Mapping;

public static partial class ContractMapper
{
    public static CollectionDetail ToCollectionDetail(DomainEntityLibrary library) =>
        new(
            library.Entity.Id,
            library.Entity.Kind.Code,
            library.Entity.Title,
            ToEntityCapabilities(library.Entity.Capabilities),
            ToEntityCards(library.Children));

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

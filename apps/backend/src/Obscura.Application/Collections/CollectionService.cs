using Obscura.Application.Entities;
using Obscura.Application.Mapping;
using Obscura.Contracts.Collections;
using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;

namespace Obscura.Application.Collections;

/// <summary>
/// Application use-case service for collection browsing and collection detail expansion.
/// </summary>
public sealed class CollectionService
{
    private readonly IEntityCatalog _entities;
    private readonly IEntityDetails _details;

    /// <summary>
    /// Creates a collection service over the shared entity catalog.
    /// </summary>
    /// <param name="entities">Catalog used to read collection entities and membership links.</param>
    public CollectionService(IEntityCatalog entities, IEntityDetails details)
    {
        _entities = entities;
        _details = details;
    }

    /// <summary>
    /// Lists collection entities.
    /// </summary>
    /// <param name="query">List query; only search and cursor are honored because this service is collection-specific.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>API-ready collection list response.</returns>
    public async Task<CollectionListResponse> ListAsync(EntityListQuery query, CancellationToken cancellationToken)
    {
        var page = await _entities.ListAsync(EntityKindRegistry.Collection, query.Search, query.Cursor, cancellationToken);
        return ContractMapper.ToCollectionListResponse(page);
    }

    /// <summary>
    /// Gets a collection and expands its collection-item links.
    /// </summary>
    /// <param name="id">Collection entity identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>API-ready collection detail contract, or null when the entity is missing or not a collection.</returns>
    public async Task<CollectionDetail?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var collection = await _details.GetCollectionAsync(id, cancellationToken);
        return collection is null ? null : ContractMapper.ToCollectionDetail(collection);
    }
}

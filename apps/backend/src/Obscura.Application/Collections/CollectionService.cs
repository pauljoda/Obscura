using Obscura.Application.Entities;
using Obscura.Application.Mapping;
using Obscura.Application.Settings;
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
    private readonly ISettingsService _settings;

    /// <summary>
    /// Creates a collection service over the shared entity catalog.
    /// </summary>
    /// <param name="entities">Catalog used to read collection entities and membership links.</param>
    /// <param name="details">Detail reader used to hydrate typed collection aggregates.</param>
    /// <param name="settings">Server-side settings used to enforce visibility before contracts are serialized.</param>
    public CollectionService(IEntityCatalog entities, IEntityDetails details, ISettingsService settings)
    {
        _entities = entities;
        _details = details;
        _settings = settings;
    }

    /// <summary>
    /// Lists collection entities.
    /// </summary>
    /// <param name="query">List query; only search and cursor are honored because this service is collection-specific.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>API-ready collection list response.</returns>
    public async Task<CollectionListResponse> ListAsync(EntityListQuery query, CancellationToken cancellationToken)
    {
        var settings = await _settings.GetAsync(cancellationToken);
        var page = await _entities.ListAsync(
            EntityKindRegistry.Collection,
            query.Search,
            query.Cursor,
            settings.HideNsfw,
            cancellationToken);
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

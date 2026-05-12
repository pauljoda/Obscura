using Obscura.Application.Entities;
using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;
using Obscura.Domain.Media;

namespace Obscura.Application.Collections;

/// <summary>
/// Application use-case service for collection browsing and collection detail expansion.
/// </summary>
public sealed class CollectionService
{
    private readonly IEntityCatalog _entities;

    /// <summary>
    /// Creates a collection service over the shared entity catalog.
    /// </summary>
    /// <param name="entities">Catalog used to read collection entities and membership links.</param>
    public CollectionService(IEntityCatalog entities)
    {
        _entities = entities;
    }

    /// <summary>
    /// Lists collection entities.
    /// </summary>
    /// <param name="query">List query; only search and cursor are honored because this service is collection-specific.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>A page of collection entity roots.</returns>
    public Task<EntityPage> ListAsync(EntityListQuery query, CancellationToken cancellationToken) =>
        _entities.ListAsync("collection", query.Search, query.Cursor, cancellationToken);

    /// <summary>
    /// Gets a collection and expands its collection-item links.
    /// </summary>
    /// <param name="id">Collection entity identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>The collection aggregate, or null when the entity is missing or not a collection.</returns>
    public async Task<Collection?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await _entities.GetAsync(id, cancellationToken);
        if (entity is null || !entity.Kind.Code.Equals("collection", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var items = await _entities.ListChildrenAsync(id, "collection-item", null, cancellationToken);

        return new Collection(entity, items);
    }
}

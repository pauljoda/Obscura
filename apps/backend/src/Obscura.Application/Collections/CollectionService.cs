using Obscura.Application.Entities;
using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;
using Obscura.Domain.Media;

namespace Obscura.Application.Collections;

public sealed class CollectionService
{
    private readonly IEntityCatalog _entities;

    public CollectionService(IEntityCatalog entities)
    {
        _entities = entities;
    }

    public Task<EntityPage> ListAsync(EntityListQuery query, CancellationToken cancellationToken) =>
        _entities.ListAsync("collection", query.Search, query.Cursor, cancellationToken);

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

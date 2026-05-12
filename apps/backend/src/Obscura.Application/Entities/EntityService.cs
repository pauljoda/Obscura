using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;

namespace Obscura.Application.Entities;

public sealed class EntityService
{
    private readonly IEntityCatalog _entities;
    private readonly IRatingService _ratings;

    public EntityService(IEntityCatalog entities, IRatingService ratings)
    {
        _entities = entities;
        _ratings = ratings;
    }

    public Task<EntityPage> ListAsync(EntityListQuery query, CancellationToken cancellationToken) =>
        _entities.ListAsync(query.Kind, query.Search, query.Cursor, cancellationToken);

    public Task<Entity?> GetAsync(Guid id, CancellationToken cancellationToken) =>
        _entities.GetAsync(id, cancellationToken);

    public Task<IReadOnlyList<Entity>> ListChildrenAsync(
        Guid parentId,
        string relationship,
        string? childKind,
        CancellationToken cancellationToken) =>
        _entities.ListChildrenAsync(parentId, relationship, childKind, cancellationToken);

    public Task<Entity?> SetRatingAsync(SetEntityRatingCommand command, CancellationToken cancellationToken) =>
        _ratings.UpdateRatingAsync(command.EntityId, command.Value, cancellationToken);

    public Task<Entity?> UpdateFlagsAsync(UpdateEntityFlagsCommand command, CancellationToken cancellationToken) =>
        _ratings.UpdateFlagsAsync(
            command.EntityId,
            command.IsFavorite,
            command.IsNsfw,
            command.IsOrganized,
            cancellationToken);
}

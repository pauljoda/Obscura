using Obscura.Domain.Entities;

namespace Obscura.Domain.Interfaces;

public interface IEntityCatalog
{
    Task<EntityPage> ListAsync(
        string? kind,
        string? query,
        string? cursor,
        CancellationToken cancellationToken);

    Task<Entity?> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<IReadOnlyList<Entity>> ListChildrenAsync(
        Guid parentId,
        string relationship,
        string? childKind,
        CancellationToken cancellationToken);
}

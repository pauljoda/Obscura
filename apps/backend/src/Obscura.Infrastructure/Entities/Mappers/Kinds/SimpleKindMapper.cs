using Obscura.Contracts.Entities;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities.Mappers.Kinds;

/// <summary>
/// Base mapper for entity kinds that have no per-kind detail table. Subclasses only need
/// to declare <see cref="IEntityKindMapper.Kind"/> and the concrete constructor; the
/// detail-row write is a no-op and detail projection falls back to the shared card.
/// Subclasses with a kind-specific detail contract override <see cref="ProjectDetail"/>.
/// </summary>
public abstract class SimpleKindMapper(ObscuraDbContext db) : IEntityKindMapper {
    protected ObscuraDbContext Db { get; } = db;

    public abstract EntityKind Kind { get; }

    public Task<Entity> ConstructAsync(EntityRow row, CancellationToken cancellationToken) =>
        Task.FromResult(Construct(row));

    public Task PersistDetailAsync(Entity entity, CancellationToken cancellationToken) =>
        Task.CompletedTask;

    public virtual IEntityCard ProjectDetail(
        Entity entity,
        EntityCard card,
        IReadOnlyList<EntityCreditMetadata> creditMetadata) =>
        card;

    protected abstract Entity Construct(EntityRow row);
}

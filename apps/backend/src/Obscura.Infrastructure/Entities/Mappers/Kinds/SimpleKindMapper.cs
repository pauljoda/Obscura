using Obscura.Domain.Entities;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities.Mappers.Kinds;

/// <summary>
/// Base mapper for entity kinds that have no per-kind detail table. Subclasses only need
/// to declare <see cref="IEntityKindMapper.Kind"/> and the concrete constructor. The
/// <see cref="ObscuraDbContext"/> dependency is held on the base so every mapper shares the
/// same constructor signature for DI and test discovery, even when this concrete mapper
/// has nothing to read or write.
/// </summary>
public abstract class SimpleKindMapper(ObscuraDbContext db) : IEntityKindMapper {
    protected ObscuraDbContext Db { get; } = db;

    public abstract EntityKind Kind { get; }

    public Task<Entity> ConstructAsync(EntityRow row, CancellationToken cancellationToken) =>
        Task.FromResult(Construct(row));

    public Task PersistDetailAsync(Entity entity, CancellationToken cancellationToken) =>
        Task.CompletedTask;

    protected abstract Entity Construct(EntityRow row);
}

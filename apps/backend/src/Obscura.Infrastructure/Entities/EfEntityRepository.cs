using Microsoft.EntityFrameworkCore;
using Obscura.Application.Entities;
using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Entities.Mappers;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities;

/// <summary>
/// EF-backed repository that hydrates domain entities from row storage and persists their
/// mutable state. Implements the Application <see cref="IEntityWriteRepository"/> port so
/// Application services can mutate entities without taking a direct dependency on EF Core.
///
/// All kind-specific construction and per-capability row read/write logic lives in
/// <see cref="IEntityKindMapper"/> and <see cref="IEntityCapabilityMapper"/> implementations
/// discovered via dependency injection; this class is intentionally a coordinator over
/// those mappers and never branches on a concrete entity kind or capability itself.
/// </summary>
public sealed class EfEntityRepository : IEntityWriteRepository {
    private const string RelatedRelationshipCode = "related";

    private readonly ObscuraDbContext _db;
    private readonly IReadOnlyDictionary<EntityKind, IEntityKindMapper> _kindMappers;
    private readonly IReadOnlyList<IEntityCapabilityMapper> _capabilityMappers;

    public EfEntityRepository(
        ObscuraDbContext db,
        IEnumerable<IEntityKindMapper> kindMappers,
        IEnumerable<IEntityCapabilityMapper> capabilityMappers) {
        _db = db;
        _kindMappers = kindMappers.ToDictionary(mapper => mapper.Kind);
        _capabilityMappers = capabilityMappers.ToArray();
    }

    /// <summary>
    /// Finds an active entity and hydrates its domain relationships plus mutable state capabilities.
    /// </summary>
    public async Task<Entity?> FindAsync(Guid id, CancellationToken cancellationToken) {
        var row = await _db.Entities.AsNoTracking()
            .FirstOrDefaultAsync(entity => entity.Id == id && entity.DeletedAt == null, cancellationToken);
        if (row is null) {
            return null;
        }

        var context = new EntityHydrationContext();
        return await HydrateAsync(row, context, cancellationToken);
    }

    /// <summary>
    /// Finds an active entity and returns it only when it matches the requested concrete domain type.
    /// </summary>
    public async Task<TEntity?> FindAsync<TEntity>(Guid id, CancellationToken cancellationToken)
        where TEntity : Entity =>
        await FindAsync(id, cancellationToken) is TEntity entity ? entity : null;

    /// <summary>
    /// Finds a required active entity of the requested concrete domain type.
    /// </summary>
    public async Task<TEntity> RequireAsync<TEntity>(Guid id, CancellationToken cancellationToken)
        where TEntity : Entity =>
        await FindAsync<TEntity>(id, cancellationToken)
            ?? throw new InvalidOperationException($"Entity '{id}' was not found as {typeof(TEntity).Name}.");

    /// <summary>
    /// Persists one hydrated domain entity slice, including structural links, relationships, and mutable capabilities.
    /// </summary>
    public async Task SaveAsync(Entity entity, CancellationToken cancellationToken) {
        ArgumentNullException.ThrowIfNull(entity);
        var visited = new HashSet<Guid>();
        await SaveEntityAsync(entity, visited, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<Entity> HydrateAsync(
        EntityRow row,
        EntityHydrationContext context,
        CancellationToken cancellationToken) {
        if (context.TryGet(row.Id, out var existing)) {
            return existing;
        }

        var entity = await ConstructEntityAsync(row, cancellationToken);
        context.Add(entity);
        await HydrateChildrenAsync(entity, context, cancellationToken);
        await HydrateRelationshipsAsync(entity, context, cancellationToken);
        foreach (var mapper in _capabilityMappers) {
            await mapper.HydrateAsync(entity, cancellationToken);
        }
        return entity;
    }

    private async Task<Entity> ConstructEntityAsync(EntityRow row, CancellationToken cancellationToken) {
        var kind = EntityKindRegistry.Require(row.KindCode);
        if (!_kindMappers.TryGetValue(kind, out var mapper)) {
            throw new InvalidOperationException($"Entity kind '{row.KindCode}' cannot be hydrated.");
        }

        return await mapper.ConstructAsync(row, cancellationToken);
    }

    private async Task HydrateChildrenAsync(
        Entity entity,
        EntityHydrationContext context,
        CancellationToken cancellationToken) {
        var childRows = await _db.Entities.AsNoTracking()
            .Where(row => row.ParentEntityId == entity.Id && row.DeletedAt == null)
            .OrderBy(row => row.SortOrder)
            .ThenBy(row => row.CreatedAt)
            .ThenBy(row => row.Id)
            .ToArrayAsync(cancellationToken);
        foreach (var childRow in childRows) {
            var child = await HydrateAsync(childRow, context, cancellationToken);
            if (!entity.ChildEntities.Any(existing => existing.Id == child.Id)) {
                entity.AddChild(child, childRow.SortOrder);
            }
        }
    }

    private async Task HydrateRelationshipsAsync(
        Entity entity,
        EntityHydrationContext context,
        CancellationToken cancellationToken) {
        var links = await _db.EntityRelationshipLinks.AsNoTracking()
            .Where(link => link.EntityId == entity.Id &&
                           link.RelationshipCode == RelatedRelationshipCode)
            .OrderBy(link => link.SortOrder)
            .ToArrayAsync(cancellationToken);
        var targetIds = links.Select(link => link.TargetEntityId).ToArray();
        var targetRows = await _db.Entities.AsNoTracking()
            .Where(row => targetIds.Contains(row.Id) && row.DeletedAt == null)
            .ToDictionaryAsync(row => row.Id, cancellationToken);
        foreach (var link in links) {
            if (!targetRows.TryGetValue(link.TargetEntityId, out var targetRow)) {
                continue;
            }

            var target = await HydrateAsync(targetRow, context, cancellationToken);
            if (!entity.Relationships.Any(existing => existing.Id == target.Id)) {
                entity.AddRelationship(target);
            }
        }
    }

    private async Task SaveEntityAsync(Entity entity, ISet<Guid> visited, CancellationToken cancellationToken) {
        if (!visited.Add(entity.Id)) {
            return;
        }

        await UpsertEntityRowAsync(entity, cancellationToken);

        foreach (var child in entity.ChildEntities) {
            await SaveEntityAsync(child, visited, cancellationToken);
        }

        foreach (var relationship in entity.Relationships) {
            await SaveEntityAsync(relationship, visited, cancellationToken);
        }

        foreach (var credit in entity.Credits?.Credits ?? Array.Empty<CapabilityCredits.Item>()) {
            await SaveEntityAsync(credit.Person, visited, cancellationToken);
        }

        _db.EntityRelationshipLinks.RemoveRange(
            _db.EntityRelationshipLinks.Where(link =>
                link.EntityId == entity.Id &&
                link.RelationshipCode == RelatedRelationshipCode));
        foreach (var mapper in _capabilityMappers) {
            await mapper.ClearAsync(entity, cancellationToken);
        }

        // Flush all stale rows before re-queueing the new state. The intermediate save is
        // here because rows keyed by EntityId (description, classification, …) would
        // otherwise collide with their re-added counterparts in the same change tracker.
        await _db.SaveChangesAsync(cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var relationshipIndex = 0;
        foreach (var relationship in entity.Relationships) {
            _db.EntityRelationshipLinks.Add(new EntityRelationshipLinkRow {
                EntityId = entity.Id,
                RelationshipCode = RelatedRelationshipCode,
                Label = relationship.Title,
                TargetEntityId = relationship.Id,
                TargetKindCode = EntityKindRegistry.ToCode(relationship.Kind),
                SortOrder = relationshipIndex,
                CreatedAt = now,
            });
            relationshipIndex++;
        }

        foreach (var mapper in _capabilityMappers) {
            await mapper.PersistAsync(entity, cancellationToken);
        }

        if (_kindMappers.TryGetValue(entity.Kind, out var kindMapper)) {
            await kindMapper.PersistDetailAsync(entity, cancellationToken);
        }
    }

    private async Task UpsertEntityRowAsync(Entity entity, CancellationToken cancellationToken) {
        var row = await _db.Entities.FindAsync([entity.Id], cancellationToken);
        var now = DateTimeOffset.UtcNow;
        if (row is null) {
            _db.Entities.Add(new EntityRow {
                Id = entity.Id,
                KindCode = EntityKindRegistry.ToCode(entity.Kind),
                Title = entity.Title,
                ParentEntityId = entity.ParentEntityId,
                SortOrder = entity.SortOrder,
                CreatedAt = now,
                UpdatedAt = now,
            });
            return;
        }

        row.KindCode = EntityKindRegistry.ToCode(entity.Kind);
        row.Title = entity.Title;
        row.ParentEntityId = entity.ParentEntityId;
        row.SortOrder = entity.SortOrder;
        row.UpdatedAt = now;
    }

    private sealed class EntityHydrationContext {
        private readonly Dictionary<Guid, Entity> _entities = [];

        public bool TryGet(Guid id, out Entity entity) => _entities.TryGetValue(id, out entity!);

        public void Add(Entity entity) => _entities.Add(entity.Id, entity);
    }
}

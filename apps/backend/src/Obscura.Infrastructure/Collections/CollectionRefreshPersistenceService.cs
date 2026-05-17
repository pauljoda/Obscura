using Microsoft.EntityFrameworkCore;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Collections;

/// <summary>
/// Infrastructure adapter for <see cref="ICollectionRefreshPersistence"/>.
/// Manages dynamic collection membership against the v2 entity model.
/// </summary>
public sealed class CollectionRefreshPersistenceService(ObscuraDbContext db) : ICollectionRefreshPersistence
{
    public async Task<CollectionRefreshData?> GetDynamicCollectionAsync(
        Guid collectionEntityId, CancellationToken cancellationToken)
    {
        var row = await db.CollectionDetails
            .Where(c => c.EntityId == collectionEntityId &&
                        (c.Mode == CollectionMode.Dynamic || c.Mode == CollectionMode.Hybrid))
            .Select(c => new { c.EntityId, c.Mode, c.RuleTreeJson })
            .FirstOrDefaultAsync(cancellationToken);

        if (row?.RuleTreeJson is null) return null;

        var entity = await db.Entities
            .Where(e => e.Id == collectionEntityId && e.DeletedAt == null)
            .Select(e => e.Title)
            .FirstOrDefaultAsync(cancellationToken);

        if (entity is null) return null;

        return new CollectionRefreshData(
            row.EntityId,
            entity,
            row.Mode,
            row.RuleTreeJson);
    }

    public async Task RefreshCollectionItemsAsync(
        Guid collectionEntityId,
        IReadOnlyList<CollectionRuleMatch> resolvedItems,
        CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        var dynamicItems = await db.CollectionItemDetails
            .Where(ci => ci.CollectionEntityId == collectionEntityId &&
                         ci.Source == CollectionItemSource.Dynamic)
            .ToListAsync(cancellationToken);
        db.CollectionItemDetails.RemoveRange(dynamicItems);
        var dynamicLinks = await db.EntityChildLinks
            .Where(link => link.ParentEntityId == collectionEntityId &&
                           !link.IsStructural &&
                           link.Source == CollectionItemSource.Dynamic.ToCode())
            .ToListAsync(cancellationToken);
        db.EntityChildLinks.RemoveRange(dynamicLinks);
        await db.SaveChangesAsync(cancellationToken);

        var maxSortOrder = await db.CollectionItemDetails
            .Where(ci => ci.CollectionEntityId == collectionEntityId)
            .Select(ci => (int?)ci.SortOrder)
            .MaxAsync(cancellationToken) ?? -1;

        var sortOrder = maxSortOrder + 1;
        var existingItemIds = await db.CollectionItemDetails
            .Where(ci => ci.CollectionEntityId == collectionEntityId)
            .Select(ci => ci.ItemEntityId)
            .ToHashSetAsync(cancellationToken);

        var now = DateTimeOffset.UtcNow;
        foreach (var item in resolvedItems)
        {
            if (existingItemIds.Contains(item.EntityId)) continue;

            db.CollectionItemDetails.Add(new CollectionItemDetailRow
            {
                Id = Guid.NewGuid(),
                CollectionEntityId = collectionEntityId,
                ItemEntityId = item.EntityId,
                Source = CollectionItemSource.Dynamic,
                SortOrder = sortOrder++,
                AddedAt = now
            });
            var childKindCode = await db.Entities
                .Where(entity => entity.Id == item.EntityId)
                .Select(entity => entity.KindCode)
                .FirstAsync(cancellationToken);
            db.EntityChildLinks.Add(new EntityChildLinkRow
            {
                ParentEntityId = collectionEntityId,
                ChildEntityId = item.EntityId,
                ChildKindCode = childKindCode,
                SortOrder = sortOrder - 1,
                IsStructural = false,
                Source = CollectionItemSource.Dynamic.ToCode(),
                CreatedAt = now
            });
            existingItemIds.Add(item.EntityId);
        }

        await db.SaveChangesAsync(cancellationToken);

        var totalCount = await db.CollectionItemDetails
            .CountAsync(ci => ci.CollectionEntityId == collectionEntityId, cancellationToken);

        var detail = await db.CollectionDetails
            .FirstAsync(c => c.EntityId == collectionEntityId, cancellationToken);
        detail.LastRefreshedAt = now;

        var entity = await db.Entities
            .FirstAsync(e => e.Id == collectionEntityId, cancellationToken);
        entity.UpdatedAt = now;

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }
}

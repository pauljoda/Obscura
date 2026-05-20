using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Entities;
using Obscura.Domain.Media;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities.Mappers.Kinds;

internal sealed class CollectionKindMapper(ObscuraDbContext db) : IEntityKindMapper {
    public EntityKind Kind => EntityKind.Collection;

    public async Task<Entity> ConstructAsync(EntityRow row, CancellationToken cancellationToken) {
        var detail = await db.CollectionDetails.AsNoTracking()
            .FirstOrDefaultAsync(d => d.EntityId == row.Id, cancellationToken);
        return detail is null
            ? new Collection(row.Id, row.Title)
            : new Collection(
                row.Id,
                row.Title,
                detail.Mode,
                detail.RuleTreeJson,
                detail.CoverMode,
                detail.CoverItemEntityId,
                TimeSpan.FromSeconds(detail.SlideshowDurationSeconds),
                detail.SlideshowAutoAdvance,
                detail.LastRefreshedAt);
    }

    public async Task PersistDetailAsync(Entity entity, CancellationToken cancellationToken) {
        if (entity is not Collection collection) {
            return;
        }

        var row = await db.CollectionDetails.FindAsync([entity.Id], cancellationToken)
            ?? Track(new CollectionDetailRow { EntityId = entity.Id });
        row.Mode = collection.Mode;
        row.RuleTreeJson = collection.RuleTreeJson;
        row.CoverMode = collection.CoverMode;
        row.CoverItemEntityId = collection.CoverItemId;
        row.SlideshowDurationSeconds = (int)collection.SlideshowDuration.TotalSeconds;
        row.SlideshowAutoAdvance = collection.SlideshowAutoAdvance;
        row.LastRefreshedAt = collection.LastRefreshedAt;
    }

    private CollectionDetailRow Track(CollectionDetailRow row) {
        db.CollectionDetails.Add(row);
        return row;
    }
}

using Microsoft.EntityFrameworkCore;
using Obscura.Contracts.Entities;
using Obscura.Contracts.Taxonomy;
using Obscura.Domain.Entities;
using Obscura.Domain.Taxonomy;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities.Mappers.Kinds;

internal sealed class TagKindMapper(ObscuraDbContext db) : IEntityKindMapper {
    public EntityKind Kind => EntityKind.Tag;

    public async Task<Entity> ConstructAsync(EntityRow row, CancellationToken cancellationToken) {
        var detail = await db.TagDetails.AsNoTracking()
            .FirstOrDefaultAsync(d => d.EntityId == row.Id, cancellationToken);
        return new Tag(row.Id, row.Title, detail?.IgnoreAutoTag ?? false);
    }

    public async Task PersistDetailAsync(Entity entity, CancellationToken cancellationToken) {
        if (entity is not Tag tag) {
            return;
        }

        var row = await db.TagDetails.FindAsync([entity.Id], cancellationToken)
            ?? Track(new TagDetailRow { EntityId = entity.Id });
        row.IgnoreAutoTag = tag.IgnoreAutoTag;
    }

    public IEntityCard ProjectDetail(
        Entity entity,
        EntityCard card,
        IReadOnlyList<EntityCreditMetadata> creditMetadata) =>
        entity is Tag tag
            ? new TagDetail {
                Id = card.Id,
                Kind = card.Kind,
                Title = card.Title,
                ParentEntityId = card.ParentEntityId,
                SortOrder = card.SortOrder,
                Capabilities = card.Capabilities,
                ChildrenByKind = card.ChildrenByKind,
                Relationships = card.Relationships,
                IgnoreAutoTag = tag.IgnoreAutoTag,
            }
            : card;

    private TagDetailRow Track(TagDetailRow row) {
        db.TagDetails.Add(row);
        return row;
    }
}

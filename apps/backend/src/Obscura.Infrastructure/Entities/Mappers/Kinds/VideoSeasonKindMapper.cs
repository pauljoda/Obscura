using Obscura.Contracts.Entities;
using Obscura.Contracts.Series;
using Obscura.Domain.Entities;
using Obscura.Domain.Media;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities.Mappers.Kinds;

internal sealed class VideoSeasonKindMapper(ObscuraDbContext db) : SimpleKindMapper(db) {
    public override EntityKind Kind => EntityKind.VideoSeason;

    protected override Entity Construct(EntityRow row) =>
        new VideoSeason(row.Id, row.Title, row.ParentEntityId, sortOrder: row.SortOrder);

    public override IEntityCard ProjectDetail(
        Entity entity,
        EntityCard card,
        IReadOnlyList<EntityCreditMetadata> creditMetadata) =>
        new VideoSeasonDetail {
            Id = card.Id,
            Kind = card.Kind,
            Title = card.Title,
            ParentEntityId = card.ParentEntityId,
            SortOrder = card.SortOrder,
            Capabilities = card.Capabilities,
            ChildrenByKind = card.ChildrenByKind,
            Relationships = card.Relationships,
        };
}

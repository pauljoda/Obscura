using Obscura.Contracts.Entities;
using Obscura.Contracts.Taxonomy;
using Obscura.Domain.Entities;
using Obscura.Domain.Taxonomy;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities.Mappers.Kinds;

internal sealed class StudioKindMapper(ObscuraDbContext db) : SimpleKindMapper(db) {
    public override EntityKind Kind => EntityKind.Studio;

    protected override Entity Construct(EntityRow row) => new Studio(row.Id, row.Title);

    public override IEntityCard ProjectDetail(
        Entity entity,
        EntityCard card,
        IReadOnlyList<EntityCreditMetadata> creditMetadata) =>
        new StudioDetail {
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

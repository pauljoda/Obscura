using Obscura.Contracts.Entities;
using Obscura.Contracts.Media;
using Obscura.Domain.Entities;
using Obscura.Domain.Media;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities.Mappers.Kinds;

internal sealed class AudioLibraryKindMapper(ObscuraDbContext db) : SimpleKindMapper(db) {
    public override EntityKind Kind => EntityKind.AudioLibrary;

    protected override Entity Construct(EntityRow row) => new AudioLibrary(row.Id, row.Title);

    public override IEntityCard ProjectDetail(
        Entity entity,
        EntityCard card,
        IReadOnlyList<EntityCreditMetadata> creditMetadata) =>
        new AudioLibraryDetail {
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

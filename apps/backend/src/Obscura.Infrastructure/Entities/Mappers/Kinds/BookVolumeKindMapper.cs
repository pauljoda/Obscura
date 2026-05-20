using Obscura.Domain.Entities;
using Obscura.Domain.Media;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities.Mappers.Kinds;

internal sealed class BookVolumeKindMapper(ObscuraDbContext db) : SimpleKindMapper(db) {
    public override EntityKind Kind => EntityKind.BookVolume;
    protected override Entity Construct(EntityRow row) => new BookVolume(row.Id, row.Title);
}

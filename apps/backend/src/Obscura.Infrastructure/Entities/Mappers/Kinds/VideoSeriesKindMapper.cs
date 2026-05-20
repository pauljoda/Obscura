using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Entities;
using Obscura.Domain.Media;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities.Mappers.Kinds;

internal sealed class VideoSeriesKindMapper(ObscuraDbContext db) : IEntityKindMapper {
    public EntityKind Kind => EntityKind.VideoSeries;

    public async Task<Entity> ConstructAsync(EntityRow row, CancellationToken cancellationToken) {
        var detail = await db.VideoSeriesDetails.AsNoTracking()
            .FirstOrDefaultAsync(d => d.EntityId == row.Id, cancellationToken);
        return new VideoSeries(row.Id, row.Title, detail?.Status);
    }

    public async Task PersistDetailAsync(Entity entity, CancellationToken cancellationToken) {
        if (entity is not VideoSeries series) {
            return;
        }

        var row = await db.VideoSeriesDetails.FindAsync([entity.Id], cancellationToken)
            ?? Track(new VideoSeriesDetailRow { EntityId = entity.Id });
        row.Status = series.Status;
    }

    private VideoSeriesDetailRow Track(VideoSeriesDetailRow row) {
        db.VideoSeriesDetails.Add(row);
        return row;
    }
}

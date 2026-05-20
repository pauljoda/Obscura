using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Entities;
using Obscura.Domain.Media;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities.Mappers.Kinds;

internal sealed class VideoKindMapper(ObscuraDbContext db) : IEntityKindMapper {
    public EntityKind Kind => EntityKind.Video;

    public async Task<Entity> ConstructAsync(EntityRow row, CancellationToken cancellationToken) {
        var detail = await db.VideoDetails.AsNoTracking()
            .FirstOrDefaultAsync(d => d.EntityId == row.Id, cancellationToken);
        return new Video(row.Id, row.Title, detail?.SubtitlesExtractedAt);
    }

    public async Task PersistDetailAsync(Entity entity, CancellationToken cancellationToken) {
        if (entity is not Video video) {
            return;
        }

        var row = await db.VideoDetails.FindAsync([entity.Id], cancellationToken)
            ?? Track(new VideoDetailRow { EntityId = entity.Id });
        row.SubtitlesExtractedAt = video.SubtitlesExtractedAt;
    }

    private VideoDetailRow Track(VideoDetailRow row) {
        db.VideoDetails.Add(row);
        return row;
    }
}

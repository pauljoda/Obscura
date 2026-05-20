using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Entities;
using Obscura.Domain.Media;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities.Mappers.Kinds;

internal sealed class AudioTrackKindMapper(ObscuraDbContext db) : IEntityKindMapper {
    public EntityKind Kind => EntityKind.AudioTrack;

    public async Task<Entity> ConstructAsync(EntityRow row, CancellationToken cancellationToken) {
        var detail = await db.AudioTrackDetails.AsNoTracking()
            .FirstOrDefaultAsync(d => d.EntityId == row.Id, cancellationToken);
        return new AudioTrack(row.Id, row.Title, detail?.EmbeddedArtist, detail?.EmbeddedAlbum);
    }

    public async Task PersistDetailAsync(Entity entity, CancellationToken cancellationToken) {
        if (entity is not AudioTrack track) {
            return;
        }

        var row = await db.AudioTrackDetails.FindAsync([entity.Id], cancellationToken)
            ?? Track(new AudioTrackDetailRow { EntityId = entity.Id });
        row.EmbeddedArtist = track.EmbeddedArtist;
        row.EmbeddedAlbum = track.EmbeddedAlbum;
    }

    private AudioTrackDetailRow Track(AudioTrackDetailRow row) {
        db.AudioTrackDetails.Add(row);
        return row;
    }
}

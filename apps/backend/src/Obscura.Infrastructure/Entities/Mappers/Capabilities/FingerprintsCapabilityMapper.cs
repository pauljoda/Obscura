using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities.Mappers.Capabilities;

internal sealed class FingerprintsCapabilityMapper(ObscuraDbContext db) : IEntityCapabilityMapper {
    public async Task HydrateAsync(Entity entity, CancellationToken cancellationToken) {
        var rows = await db.EntityFileFingerprints.AsNoTracking()
            .Where(r => r.EntityId == entity.Id)
            .OrderBy(r => r.CreatedAt)
            .ToArrayAsync(cancellationToken);
        if (rows.Length == 0) {
            return;
        }

        entity.RemoveCapability<CapabilityFingerprints>();
        entity.AddCapability(new CapabilityFingerprints(
            rows.Select(r => new CapabilityFingerprints.Item(r.Algorithm, r.Value)).ToArray()));
    }

    public Task ClearAsync(Entity entity, CancellationToken cancellationToken) {
        db.EntityFileFingerprints.RemoveRange(db.EntityFileFingerprints.Where(r => r.EntityId == entity.Id));
        return Task.CompletedTask;
    }

    public Task PersistAsync(Entity entity, CancellationToken cancellationToken) {
        if (entity.GetCapability<CapabilityFingerprints>() is not { } fingerprints) {
            return Task.CompletedTask;
        }

        var now = DateTimeOffset.UtcNow;
        foreach (var fingerprint in fingerprints.Items) {
            db.EntityFileFingerprints.Add(new EntityFileFingerprintRow {
                Id = Guid.NewGuid(),
                EntityId = entity.Id,
                Algorithm = fingerprint.Algorithm,
                Value = fingerprint.Value,
                CreatedAt = now,
            });
        }

        return Task.CompletedTask;
    }
}

using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities.Mappers.Capabilities;

internal sealed class FlagsCapabilityMapper(ObscuraDbContext db) : IEntityCapabilityMapper {
    public async Task HydrateAsync(Entity entity, CancellationToken cancellationToken) {
        var row = await db.EntityFlags.AsNoTracking()
            .FirstOrDefaultAsync(r => r.EntityId == entity.Id, cancellationToken);
        if (row is null) {
            return;
        }

        var flags = entity.Flags ?? new CapabilityFlags();
        if (entity.Flags is null) {
            entity.AddCapability(flags);
        }

        flags.Patch(row.IsFavorite, row.IsNsfw, row.IsOrganized);
    }

    public Task ClearAsync(Entity entity, CancellationToken cancellationToken) => Task.CompletedTask;

    public async Task PersistAsync(Entity entity, CancellationToken cancellationToken) {
        if (entity.Flags is not { } flags) {
            return;
        }

        var existing = await db.EntityFlags.FindAsync([entity.Id], cancellationToken);
        var now = DateTimeOffset.UtcNow;

        if (existing is null) {
            db.EntityFlags.Add(new EntityFlagRow {
                EntityId = entity.Id,
                IsFavorite = flags.IsFavorite ?? false,
                IsNsfw = flags.IsNsfw ?? false,
                IsOrganized = flags.IsOrganized ?? false,
                UpdatedAt = now,
            });
        } else {
            existing.IsFavorite = flags.IsFavorite ?? false;
            existing.IsNsfw = flags.IsNsfw ?? false;
            existing.IsOrganized = flags.IsOrganized ?? false;
            existing.UpdatedAt = now;
        }
    }
}

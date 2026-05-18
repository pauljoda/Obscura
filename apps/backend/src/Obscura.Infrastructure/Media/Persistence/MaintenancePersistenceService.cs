using Microsoft.EntityFrameworkCore;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Persistence;

namespace Obscura.Infrastructure.Media.Persistence;

/// <summary>
/// Infrastructure adapter for <see cref="IMaintenancePersistence"/>.
/// </summary>
public sealed class MaintenancePersistenceService(ObscuraDbContext db, string dataDir) : IMaintenancePersistence {
    public async Task<IReadOnlyList<Guid>> GetActiveEntityIdsByKindAsync(EntityKind kind, CancellationToken cancellationToken) =>
        await db.Entities
            .Where(e => e.KindCode == EntityKindRegistry.ToCode(kind) && e.DeletedAt == null)
            .Select(e => e.Id)
            .ToListAsync(cancellationToken);

    public string GetCacheBasePath() => Path.Combine(dataDir, "cache");
}

using Microsoft.EntityFrameworkCore;
using Obscura.Application.Jobs.Ports;
using Obscura.Infrastructure.Persistence;

namespace Obscura.Infrastructure.Media;

/// <summary>
/// Infrastructure adapter for <see cref="IMaintenancePersistence"/>.
/// </summary>
public sealed class MaintenancePersistenceService(ObscuraDbContext db, string dataDir) : IMaintenancePersistence
{
    public async Task<IReadOnlyList<Guid>> GetActiveEntityIdsByKindAsync(string kindCode, CancellationToken cancellationToken) =>
        await db.Entities
            .Where(e => e.KindCode == kindCode && e.DeletedAt == null)
            .Select(e => e.Id)
            .ToListAsync(cancellationToken);

    public string GetCacheBasePath() => Path.Combine(dataDir, "cache");
}

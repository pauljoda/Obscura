using Microsoft.EntityFrameworkCore;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Persistence;

namespace Obscura.Infrastructure.Media;

/// <summary>
/// Infrastructure adapter for <see cref="IMaintenancePersistence"/>.
/// </summary>
public sealed class MaintenancePersistenceService(ObscuraDbContext db, string dataDir) : IMaintenancePersistence
{
    public async Task<IReadOnlyList<Guid>> GetActiveEntityIdsByKindAsync(IEntityKind kind, CancellationToken cancellationToken) =>
        await db.Entities
            .Where(e => e.KindCode == kind.Code && e.DeletedAt == null)
            .Select(e => e.Id)
            .ToListAsync(cancellationToken);

    public string GetCacheBasePath() => Path.Combine(dataDir, "cache");
}

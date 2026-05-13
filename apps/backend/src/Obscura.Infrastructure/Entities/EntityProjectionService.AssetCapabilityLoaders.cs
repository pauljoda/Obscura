using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;
using Obscura.Domain.Media;
using Obscura.Domain.Taxonomy;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities;

/// <summary>
/// Loads file-backed asset and fingerprint capability rows for entity projection.
/// </summary>
public sealed partial class EntityProjectionService
{
    private async Task<IReadOnlyDictionary<Guid, IReadOnlyList<EntityFile>>> LoadFilesAsync(
        IReadOnlyList<Guid> entityIds,
        CancellationToken cancellationToken)
    {
        var rows = await _db.EntityFiles
            .AsNoTracking()
            .Where(file => entityIds.Contains(file.EntityId))
            .OrderBy(file => file.Role)
            .ThenBy(file => file.Path)
            .ToListAsync(cancellationToken);

        return rows
            .GroupBy(file => file.EntityId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<EntityFile>)group
                    .Select(file => new EntityFile(file.Role, file.Path, file.MimeType))
                    .ToArray());
    }

    private async Task<IReadOnlyDictionary<Guid, IReadOnlyList<EntityFingerprint>>> LoadFingerprintsAsync(
        IReadOnlyList<Guid> entityIds,
        CancellationToken cancellationToken)
    {
        var rows = await _db.EntityFileFingerprints
            .AsNoTracking()
            .Where(row => entityIds.Contains(row.EntityId))
            .OrderBy(row => row.Algorithm)
            .ToListAsync(cancellationToken);

        return rows
            .GroupBy(row => row.EntityId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<EntityFingerprint>)group
                    .Select(row => new EntityFingerprint(row.Algorithm.DecodeAs<FingerprintAlgorithm>(), row.Value))
                    .ToArray());
    }
}

using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;
using Obscura.Domain.Media;
using Obscura.Domain.Taxonomy;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities;

/// <summary>
/// Loads reference capability rows for URLs, external IDs, tags, studios, and credits.
/// </summary>
public sealed partial class EntityProjectionService
{
    private async Task<IReadOnlyDictionary<Guid, IReadOnlyList<EntityUrl>>> LoadUrlsAsync(
        IReadOnlyList<Guid> entityIds,
        CancellationToken cancellationToken)
    {
        var rows = await _db.EntityUrls
            .AsNoTracking()
            .Where(row => entityIds.Contains(row.EntityId))
            .OrderBy(row => row.SortOrder)
            .ThenBy(row => row.Url)
            .ToListAsync(cancellationToken);

        return rows
            .GroupBy(row => row.EntityId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<EntityUrl>)group
                    .Select(row => new EntityUrl(row.Url, row.Label))
                    .ToArray());
    }

    private async Task<IReadOnlyDictionary<Guid, IReadOnlyList<EntityExternalId>>> LoadExternalIdsAsync(
        IReadOnlyList<Guid> entityIds,
        CancellationToken cancellationToken)
    {
        var rows = await _db.EntityExternalIds
            .AsNoTracking()
            .Where(row => entityIds.Contains(row.EntityId))
            .OrderBy(row => row.Provider)
            .ThenBy(row => row.Value)
            .ToListAsync(cancellationToken);

        return rows
            .GroupBy(row => row.EntityId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<EntityExternalId>)group
                    .Select(row => new EntityExternalId(row.Provider, row.Value, row.Url))
                    .ToArray());
    }

    private async Task<IReadOnlyDictionary<Guid, EntityRelationships>> LoadRelationshipsAsync(
        IReadOnlyList<Guid> entityIds,
        CancellationToken cancellationToken)
    {
        var links = await _db.EntityRelationshipLinks
            .AsNoTracking()
            .Where(row => entityIds.Contains(row.EntityId))
            .OrderBy(row => row.RelationshipCode)
            .ThenBy(row => row.SortOrder)
            .ThenBy(row => row.TargetEntityId)
            .ToListAsync(cancellationToken);

        if (links.Count == 0)
        {
            return new Dictionary<Guid, EntityRelationships>();
        }

        return links
            .GroupBy(link => link.EntityId)
            .ToDictionary(
                group => group.Key,
                group => new EntityRelationships(group
                    .GroupBy(link => new { link.RelationshipCode, link.TargetKindCode, link.Label })
                    .Select(relationshipGroup =>
                    {
                        var first = relationshipGroup.First();
                        return new EntityRelationshipGroup(
                            first.RelationshipCode,
                            ResolveKind(first.TargetKindCode),
                            first.Label,
                            relationshipGroup
                                .Select(link => new EntityRelationshipItem(link.TargetEntityId, link.MetadataJson))
                                .ToArray());
                    })
                    .ToArray()));
    }

    /// <summary>
    /// Resolves a single best thumbnail URL for each referenced entity by checking
    /// files with roles Thumbnail, Poster, Cover, and Logo (in priority order).
    /// </summary>
    private async Task<IReadOnlyDictionary<Guid, string>> ResolveReferenceThumbnailsAsync(
        Guid[] referencedIds,
        CancellationToken cancellationToken)
    {
        if (referencedIds.Length == 0)
        {
            return new Dictionary<Guid, string>();
        }

        var files = await _db.EntityFiles
            .AsNoTracking()
            .Where(row => referencedIds.Contains(row.EntityId) &&
                (row.Role == EntityFileRole.Thumbnail ||
                 row.Role == EntityFileRole.Poster ||
                 row.Role == EntityFileRole.Cover ||
                 row.Role == EntityFileRole.Logo))
            .ToListAsync(cancellationToken);

        return files
            .GroupBy(f => f.EntityId)
            .ToDictionary(
                g => g.Key,
                g => (g.FirstOrDefault(f => f.Role == EntityFileRole.Thumbnail) ??
                      g.FirstOrDefault(f => f.Role == EntityFileRole.Poster) ??
                      g.FirstOrDefault(f => f.Role == EntityFileRole.Cover) ??
                      g.FirstOrDefault(f => f.Role == EntityFileRole.Logo) ??
                      g.First()).Path);
    }
}

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

    private async Task<IReadOnlyDictionary<Guid, IReadOnlyList<EntityTag>>> LoadTagReferencesAsync(
        IReadOnlyList<Guid> entityIds,
        CancellationToken cancellationToken)
    {
        var tagLinks = await _db.EntityTagLinks
            .AsNoTracking()
            .Where(link => entityIds.Contains(link.EntityId))
            .ToListAsync(cancellationToken);

        if (tagLinks.Count == 0)
        {
            return new Dictionary<Guid, IReadOnlyList<EntityTag>>();
        }

        var tagIds = tagLinks.Select(link => link.TagId).Distinct().ToArray();
        var tagTitles = await _db.Entities
            .AsNoTracking()
            .Where(entity => tagIds.Contains(entity.Id) && entity.KindCode == EntityKindRegistry.Tag.Code)
            .ToDictionaryAsync(entity => entity.Id, entity => entity.Title, cancellationToken);

        return tagLinks
            .Where(link => tagTitles.ContainsKey(link.TagId))
            .GroupBy(link => link.EntityId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<EntityTag>)group
                    .Select(link => new EntityTag(new EntityReference(
                        link.TagId,
                        EntityKindRegistry.Tag,
                        tagTitles[link.TagId])))
                    .OrderBy(tag => tag.Reference.Title, StringComparer.OrdinalIgnoreCase)
                    .ToArray());
    }

    private async Task<IReadOnlyDictionary<Guid, EntityReference>> LoadStudioReferencesAsync(
        IReadOnlyList<Guid> entityIds,
        CancellationToken cancellationToken)
    {
        var links = await _db.EntityStudioLinks
            .AsNoTracking()
            .Where(link => entityIds.Contains(link.EntityId))
            .ToListAsync(cancellationToken);

        if (links.Count == 0)
        {
            return new Dictionary<Guid, EntityReference>();
        }

        var studioIds = links.Select(link => link.StudioId).Distinct().ToArray();
        var studios = await _db.Entities
            .AsNoTracking()
            .Where(entity => studioIds.Contains(entity.Id) && entity.KindCode == EntityKindRegistry.Studio.Code && entity.DeletedAt == null)
            .ToDictionaryAsync(entity => entity.Id, cancellationToken);

        var thumbnails = await ResolveReferenceThumbnailsAsync(studioIds, cancellationToken);

        return links
            .Where(link => studios.ContainsKey(link.StudioId))
            .ToDictionary(
                link => link.EntityId,
                link =>
                {
                    var studio = studios[link.StudioId];
                    thumbnails.TryGetValue(studio.Id, out var thumb);
                    return new EntityReference(studio.Id, ResolveKind(studio.KindCode), studio.Title, thumb);
                });
    }

    private async Task<IReadOnlyDictionary<Guid, IReadOnlyList<EntityCredit>>> LoadCreditReferencesAsync(
        IReadOnlyList<Guid> entityIds,
        CancellationToken cancellationToken)
    {
        var links = await _db.EntityCreditLinks
            .AsNoTracking()
            .Where(link => entityIds.Contains(link.EntityId))
            .OrderBy(link => link.SortOrder)
            .ThenBy(link => link.PersonEntityId)
            .ToListAsync(cancellationToken);

        if (links.Count == 0)
        {
            return new Dictionary<Guid, IReadOnlyList<EntityCredit>>();
        }

        var personIds = links.Select(link => link.PersonEntityId).Distinct().ToArray();
        var people = await _db.Entities
            .AsNoTracking()
            .Where(entity => personIds.Contains(entity.Id) && entity.KindCode == EntityKindRegistry.Person.Code && entity.DeletedAt == null)
            .ToDictionaryAsync(entity => entity.Id, cancellationToken);

        var thumbnails = await ResolveReferenceThumbnailsAsync(personIds, cancellationToken);

        return links
            .Where(link => people.ContainsKey(link.PersonEntityId))
            .GroupBy(link => link.EntityId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<EntityCredit>)group
                    .Select(link =>
                    {
                        var person = people[link.PersonEntityId];
                        thumbnails.TryGetValue(person.Id, out var thumb);
                        return new EntityCredit(
                            new EntityReference(person.Id, ResolveKind(person.KindCode), person.Title, thumb),
                            link.Role,
                            link.Character);
                    })
                    .ToArray());
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

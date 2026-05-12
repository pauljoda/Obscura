using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;
using Obscura.Domain.Media;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities;

/// <summary>
/// Projects v2 PostgreSQL entity rows into Domain objects used by application services.
/// </summary>
public sealed class EntityProjectionService : IEntityCatalog, IEntityHierarchy, IRatingService, IVideoLibrary
{
    private const int PageSize = 50;
    private readonly ObscuraDbContext _db;

    /// <summary>
    /// Creates an entity projection service over the EF Core v2 context.
    /// </summary>
    /// <param name="db">Database context that owns v2 entity and capability tables.</param>
    public EntityProjectionService(ObscuraDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<EntityPage> ListAsync(
        IEntityKind? kind,
        string? query,
        string? cursor,
        CancellationToken cancellationToken)
    {
        var skip = int.TryParse(cursor, out var parsedCursor) && parsedCursor > 0
            ? parsedCursor
            : 0;

        var entityQuery = _db.Entities
            .AsNoTracking()
            .Where(entity => entity.DeletedAt == null);

        if (kind is not null)
        {
            entityQuery = entityQuery.Where(entity => entity.KindCode == kind.Code);
        }

        if (!string.IsNullOrWhiteSpace(query))
        {
            var normalizedQuery = query.ToLower();
            entityQuery = entityQuery.Where(entity => entity.Title.ToLower().Contains(normalizedQuery));
        }

        var rows = await entityQuery
            .OrderBy(entity => entity.Title)
            .ThenBy(entity => entity.Id)
            .Skip(skip)
            .Take(PageSize + 1)
            .ToListAsync(cancellationToken);

        var pageRows = rows.Take(PageSize).ToList();
        var entities = await BuildEntitiesAsync(pageRows, cancellationToken);
        var nextCursor = rows.Count > PageSize ? (skip + PageSize).ToString() : null;

        return new EntityPage(entities, nextCursor);
    }

    /// <inheritdoc />
    public async Task<Entity?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var row = await _db.Entities
            .AsNoTracking()
            .FirstOrDefaultAsync(
                entity => entity.Id == id && entity.DeletedAt == null,
                cancellationToken);

        if (row is null)
        {
            return null;
        }

        return (await BuildEntitiesAsync([row], cancellationToken)).Single();
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<Entity>> ListChildrenAsync(
        Guid parentId,
        IEntityRelationship relationship,
        IEntityKind? childKind,
        CancellationToken cancellationToken)
    {
        return await LoadLinkedChildrenAsync(parentId, relationship, childKind, cancellationToken);
    }

    /// <inheritdoc />
    public bool IsAllowed(IEntityKind parentKind, IEntityKind childKind, IEntityRelationship relationship) =>
        EntityHierarchyDefinitions.IsAllowed(parentKind, childKind, relationship);

    /// <inheritdoc />
    public async Task<EntityHierarchyTree?> GetTreeAsync(
        Guid rootId,
        HierarchyDefinition definition,
        CancellationToken cancellationToken)
    {
        var root = await GetAsync(rootId, cancellationToken);
        if (root is null || root.Kind != definition.RootKind)
        {
            return null;
        }

        var rootNode = await BuildHierarchyNodeAsync(
            root,
            definition,
            null,
            0,
            new HashSet<Guid> { root.Id },
            cancellationToken);

        return new EntityHierarchyTree(definition, rootNode);
    }

    /// <inheritdoc />
    public async Task<Entity?> UpdateRatingAsync(
        Guid id,
        int? value,
        CancellationToken cancellationToken)
    {
        var entity = await _db.Entities
            .FirstOrDefaultAsync(row => row.Id == id && row.DeletedAt == null, cancellationToken);

        if (entity is null)
        {
            return null;
        }

        if (value is null)
        {
            var existing = await _db.EntityRatings.FindAsync([id], cancellationToken);
            if (existing is not null)
            {
                _db.EntityRatings.Remove(existing);
            }
        }
        else
        {
            var rating = Math.Clamp(value.Value, 0, 5);
            var existing = await _db.EntityRatings.FindAsync([id], cancellationToken);
            if (existing is null)
            {
                _db.EntityRatings.Add(new EntityRatingRow
                {
                    EntityId = id,
                    Value = rating,
                    UpdatedAt = DateTimeOffset.UtcNow
                });
            }
            else
            {
                existing.Value = rating;
                existing.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }

        entity.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return await GetAsync(id, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<Entity?> UpdateFlagsAsync(
        Guid id,
        bool? isFavorite,
        bool? isNsfw,
        bool? isOrganized,
        CancellationToken cancellationToken)
    {
        var entity = await _db.Entities
            .FirstOrDefaultAsync(row => row.Id == id && row.DeletedAt == null, cancellationToken);

        if (entity is null)
        {
            return null;
        }

        var flags = await _db.EntityFlags.FindAsync([id], cancellationToken);
        if (flags is null)
        {
            flags = new EntityFlagRow { EntityId = id };
            _db.EntityFlags.Add(flags);
        }

        flags.IsFavorite = isFavorite ?? flags.IsFavorite;
        flags.IsNsfw = isNsfw ?? flags.IsNsfw;
        flags.IsOrganized = isOrganized ?? flags.IsOrganized;
        flags.UpdatedAt = DateTimeOffset.UtcNow;
        entity.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return await GetAsync(id, cancellationToken);
    }

    /// <inheritdoc />
    public Task<EntityPage> ListVideosAsync(CancellationToken cancellationToken) =>
        ListAsync(IEntityKind.Video, null, null, cancellationToken);

    /// <inheritdoc />
    public async Task<Video?> GetVideoAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await _db.Entities
            .AsNoTracking()
            .FirstOrDefaultAsync(
                row => row.Id == id && row.KindCode == IEntityKind.Video.Code && row.DeletedAt == null,
                cancellationToken);

        if (entity is null)
        {
            return null;
        }

        var detail = await _db.VideoDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);
        var card = (await BuildEntitiesAsync([entity], cancellationToken)).Single();
        var markers = await LoadMarkersAsync(id, cancellationToken);
        var subtitles = await LoadSubtitlesAsync(id, cancellationToken);

        return new Video(
            card,
            detail?.Summary,
            detail?.DurationMs is null ? null : TimeSpan.FromMilliseconds(detail.DurationMs.Value),
            detail?.Width,
            detail?.Height,
            new Markers(markers),
            new Subtitles(subtitles));
    }

    /// <inheritdoc />
    public Task<EntityPage> ListSeriesAsync(CancellationToken cancellationToken) =>
        ListAsync(IEntityKind.VideoSeries, null, null, cancellationToken);

    /// <inheritdoc />
    public async Task<VideoSeries?> GetSeriesAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await _db.Entities
            .AsNoTracking()
            .FirstOrDefaultAsync(
                row => row.Id == id && row.KindCode == IEntityKind.VideoSeries.Code && row.DeletedAt == null,
                cancellationToken);

        if (entity is null)
        {
            return null;
        }

        var card = (await BuildEntitiesAsync([entity], cancellationToken)).Single();
        var seasons = await LoadLinkedChildrenAsync(id, IEntityRelationship.Season, IEntityKind.VideoSeason, cancellationToken);
        var videos = await LoadLinkedChildrenAsync(id, IEntityRelationship.Episode, IEntityKind.Video, cancellationToken);

        return new VideoSeries(
            card,
            null,
            seasons,
            videos,
            seasons.Count > 0 ? VideoSeriesRenderingMode.Seasons : VideoSeriesRenderingMode.Flat);
    }

    private async Task<EntityHierarchyNode> BuildHierarchyNodeAsync(
        Entity entity,
        HierarchyDefinition definition,
        IEntityRelationship? relationshipToParent,
        int sortOrder,
        HashSet<Guid> visited,
        CancellationToken cancellationToken)
    {
        var childLinks = new List<LinkedEntity>();
        foreach (var layer in definition.Layers.Where(layer => layer.ParentKind == entity.Kind))
        {
            childLinks.AddRange(await LoadLinkedChildrenWithEdgesAsync(entity.Id, layer.Relationship, layer.ChildKind, cancellationToken));
        }

        var children = new List<EntityHierarchyNode>();
        foreach (var childLink in childLinks.OrderBy(link => link.SortOrder).ThenBy(link => link.Entity.Id))
        {
            if (!visited.Add(childLink.Entity.Id))
            {
                continue;
            }

            children.Add(await BuildHierarchyNodeAsync(
                childLink.Entity,
                definition,
                childLink.Relationship,
                childLink.SortOrder,
                visited,
                cancellationToken));
            visited.Remove(childLink.Entity.Id);
        }

        return new EntityHierarchyNode(entity, relationshipToParent, sortOrder, children);
    }

    private async Task<IReadOnlyList<Entity>> LoadLinkedChildrenAsync(
        Guid parentId,
        IEntityRelationship relationship,
        IEntityKind? childKind,
        CancellationToken cancellationToken)
    {
        var links = await _db.EntityHierarchyLinks
            .AsNoTracking()
            .Where(link => link.ParentEntityId == parentId && link.Relationship == relationship.Code)
            .OrderBy(link => link.SortOrder)
            .ThenBy(link => link.ChildEntityId)
            .ToListAsync(cancellationToken);

        if (links.Count == 0)
        {
            return [];
        }

        var childIds = links.Select(link => link.ChildEntityId).ToArray();
        var childQuery = _db.Entities
            .AsNoTracking()
            .Where(entity => childIds.Contains(entity.Id) && entity.DeletedAt == null);

        if (childKind is not null)
        {
            childQuery = childQuery.Where(entity => entity.KindCode == childKind.Code);
        }

        var childRows = await childQuery.ToListAsync(cancellationToken);
        var childCards = await BuildEntitiesAsync(childRows, cancellationToken);
        var cardsById = childCards.ToDictionary(card => card.Id);

        return links
            .Where(link => cardsById.ContainsKey(link.ChildEntityId))
            .Select(link => cardsById[link.ChildEntityId])
            .ToArray();
    }

    private async Task<IReadOnlyList<LinkedEntity>> LoadLinkedChildrenWithEdgesAsync(
        Guid parentId,
        IEntityRelationship relationship,
        IEntityKind? childKind,
        CancellationToken cancellationToken)
    {
        var links = await _db.EntityHierarchyLinks
            .AsNoTracking()
            .Where(link => link.ParentEntityId == parentId && link.Relationship == relationship.Code)
            .OrderBy(link => link.SortOrder)
            .ThenBy(link => link.ChildEntityId)
            .ToListAsync(cancellationToken);

        if (links.Count == 0)
        {
            return [];
        }

        var childIds = links.Select(link => link.ChildEntityId).ToArray();
        var childQuery = _db.Entities
            .AsNoTracking()
            .Where(entity => childIds.Contains(entity.Id) && entity.DeletedAt == null);

        if (childKind is not null)
        {
            childQuery = childQuery.Where(entity => entity.KindCode == childKind.Code);
        }

        var childRows = await childQuery.ToListAsync(cancellationToken);
        var cardsById = (await BuildEntitiesAsync(childRows, cancellationToken))
            .ToDictionary(entity => entity.Id);

        return links
            .Where(link => cardsById.ContainsKey(link.ChildEntityId))
            .Select(link => new LinkedEntity(cardsById[link.ChildEntityId], relationship, link.SortOrder))
            .ToArray();
    }

    private async Task<IReadOnlyList<Entity>> BuildEntitiesAsync(
        IReadOnlyList<EntityRow> rows,
        CancellationToken cancellationToken)
    {
        if (rows.Count == 0)
        {
            return [];
        }

        var ids = rows.Select(row => row.Id).ToArray();
        var ratings = await _db.EntityRatings
            .AsNoTracking()
            .Where(row => ids.Contains(row.EntityId))
            .ToDictionaryAsync(row => row.EntityId, row => row.Value, cancellationToken);
        var flags = await _db.EntityFlags
            .AsNoTracking()
            .Where(row => ids.Contains(row.EntityId))
            .ToDictionaryAsync(row => row.EntityId, cancellationToken);
        var tags = await LoadTagTitlesAsync(ids, cancellationToken);
        var thumbnails = await LoadFilePathsAsync(ids, EntityFileRole.Thumbnail, cancellationToken);
        var studios = await LoadStudioReferencesAsync(ids, cancellationToken);
        var credits = await LoadCreditReferencesAsync(ids, cancellationToken);
        var urls = await LoadUrlsAsync(ids, cancellationToken);
        var externalIds = await LoadExternalIdsAsync(ids, cancellationToken);

        return rows
            .Select(row =>
            {
                ratings.TryGetValue(row.Id, out var rating);
                flags.TryGetValue(row.Id, out var flag);
                tags.TryGetValue(row.Id, out var tagTitles);
                thumbnails.TryGetValue(row.Id, out var thumbnailUrl);
                studios.TryGetValue(row.Id, out var studio);
                credits.TryGetValue(row.Id, out var creditRefs);
                urls.TryGetValue(row.Id, out var urlRefs);
                externalIds.TryGetValue(row.Id, out var externalIdRefs);

                return new Entity(
                    row.Id,
                    ResolveKind(row.KindCode),
                    row.Title,
                    null,
                    new EntityCapabilities(
                        ratings.ContainsKey(row.Id) ? Rating.FromNullable(rating) : null,
                        tagTitles is null ? Tags.Empty : new Tags(tagTitles),
                        creditRefs is null ? Credits.Empty : new Credits(creditRefs),
                        studio,
                        new Images(thumbnailUrl, null),
                        new Links(urlRefs ?? [], externalIdRefs ?? []),
                        new EntityFlags(flag?.IsFavorite, flag?.IsNsfw, flag?.IsOrganized),
                        Files.Empty));
            })
            .ToArray();
    }

    private async Task<IReadOnlyList<EntityMarker>> LoadMarkersAsync(
        Guid entityId,
        CancellationToken cancellationToken)
    {
        return await _db.EntityMarkers
            .AsNoTracking()
            .Where(marker => marker.EntityId == entityId)
            .OrderBy(marker => marker.Seconds)
            .ThenBy(marker => marker.Title)
            .Select(marker => new EntityMarker(
                marker.Id,
                marker.Title,
                marker.Seconds,
                marker.EndSeconds))
            .ToArrayAsync(cancellationToken);
    }

    private async Task<IReadOnlyList<EntitySubtitle>> LoadSubtitlesAsync(
        Guid entityId,
        CancellationToken cancellationToken)
    {
        return await _db.EntitySubtitles
            .AsNoTracking()
            .Where(subtitle => subtitle.EntityId == entityId)
            .OrderByDescending(subtitle => subtitle.IsDefault)
            .ThenBy(subtitle => subtitle.Language)
            .ThenBy(subtitle => subtitle.Label)
            .Select(subtitle => new EntitySubtitle(
                subtitle.Id,
                subtitle.Language,
                subtitle.Label,
                subtitle.Format,
                subtitle.Source,
                subtitle.StoragePath,
                subtitle.SourceFormat,
                subtitle.SourcePath,
                subtitle.IsDefault))
            .ToArrayAsync(cancellationToken);
    }

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

    private async Task<IReadOnlyDictionary<Guid, IReadOnlyList<string>>> LoadTagTitlesAsync(
        IReadOnlyList<Guid> entityIds,
        CancellationToken cancellationToken)
    {
        var tagLinks = await _db.EntityTagLinks
            .AsNoTracking()
            .Where(link => entityIds.Contains(link.EntityId))
            .ToListAsync(cancellationToken);

        if (tagLinks.Count == 0)
        {
            return new Dictionary<Guid, IReadOnlyList<string>>();
        }

        var tagIds = tagLinks.Select(link => link.TagId).Distinct().ToArray();
        var tagTitles = await _db.Entities
            .AsNoTracking()
            .Where(entity => tagIds.Contains(entity.Id) && entity.KindCode == IEntityKind.Tag.Code)
            .ToDictionaryAsync(entity => entity.Id, entity => entity.Title, cancellationToken);

        return tagLinks
            .Where(link => tagTitles.ContainsKey(link.TagId))
            .GroupBy(link => link.EntityId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<string>)group
                    .Select(link => tagTitles[link.TagId])
                    .OrderBy(title => title, StringComparer.OrdinalIgnoreCase)
                    .ToArray());
    }

    private async Task<IReadOnlyDictionary<Guid, string>> LoadFilePathsAsync(
        IReadOnlyList<Guid> entityIds,
        EntityFileRole role,
        CancellationToken cancellationToken)
    {
        return await _db.EntityFiles
            .AsNoTracking()
            .Where(file => entityIds.Contains(file.EntityId) && file.Role == role)
            .ToDictionaryAsync(file => file.EntityId, file => file.Path, cancellationToken);
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
            .Where(entity => studioIds.Contains(entity.Id) && entity.KindCode == IEntityKind.Studio.Code && entity.DeletedAt == null)
            .ToDictionaryAsync(entity => entity.Id, cancellationToken);

        return links
            .Where(link => studios.ContainsKey(link.StudioId))
            .ToDictionary(
                link => link.EntityId,
                link =>
                {
                    var studio = studios[link.StudioId];
                    return new EntityReference(studio.Id, ResolveKind(studio.KindCode), studio.Title);
                });
    }

    private async Task<IReadOnlyDictionary<Guid, IReadOnlyList<EntityReference>>> LoadCreditReferencesAsync(
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
            return new Dictionary<Guid, IReadOnlyList<EntityReference>>();
        }

        var personIds = links.Select(link => link.PersonEntityId).Distinct().ToArray();
        var people = await _db.Entities
            .AsNoTracking()
            .Where(entity => personIds.Contains(entity.Id) && entity.KindCode == IEntityKind.Person.Code && entity.DeletedAt == null)
            .ToDictionaryAsync(entity => entity.Id, cancellationToken);

        return links
            .Where(link => people.ContainsKey(link.PersonEntityId))
            .GroupBy(link => link.EntityId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<EntityReference>)group
                    .Select(link =>
                    {
                        var person = people[link.PersonEntityId];
                        return new EntityReference(person.Id, ResolveKind(person.KindCode), person.Title);
                    })
                    .ToArray());
    }

    private static IEntityKind ResolveKind(string code) => IEntityKind.Require(code);

    private sealed record LinkedEntity(Entity Entity, IEntityRelationship Relationship, int SortOrder);
}

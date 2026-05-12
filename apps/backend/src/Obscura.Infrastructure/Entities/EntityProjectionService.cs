using Microsoft.EntityFrameworkCore;
using Obscura.Contracts.Entities;
using Obscura.Contracts.Series;
using Obscura.Contracts.Videos;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities;

public sealed class EntityProjectionService : IEntityProjectionService
{
    private const int PageSize = 50;
    private readonly ObscuraDbContext _db;

    public EntityProjectionService(ObscuraDbContext db)
    {
        _db = db;
    }

    public async Task<EntityListResponse> ListAsync(
        string? kind,
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

        if (!string.IsNullOrWhiteSpace(kind))
        {
            entityQuery = entityQuery.Where(entity => entity.KindCode == kind);
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
        var cards = await BuildCardsAsync(pageRows, cancellationToken);
        var nextCursor = rows.Count > PageSize ? (skip + PageSize).ToString() : null;

        return new EntityListResponse(cards, nextCursor);
    }

    public async Task<EntityCard?> GetCardAsync(Guid id, CancellationToken cancellationToken)
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

        return (await BuildCardsAsync([row], cancellationToken)).Single();
    }

    public async Task<IReadOnlyList<EntityCard>> ListChildrenAsync(
        Guid parentId,
        string relationship,
        string? childKind,
        CancellationToken cancellationToken)
    {
        return await LoadLinkedChildrenAsync(parentId, relationship, childKind, cancellationToken);
    }

    public async Task<EntityCard?> UpdateRatingAsync(
        Guid id,
        RatingUpdateRequest request,
        CancellationToken cancellationToken)
    {
        var entity = await _db.Entities
            .FirstOrDefaultAsync(row => row.Id == id && row.DeletedAt == null, cancellationToken);

        if (entity is null)
        {
            return null;
        }

        if (request.Value is null)
        {
            var existing = await _db.EntityRatings.FindAsync([id], cancellationToken);
            if (existing is not null)
            {
                _db.EntityRatings.Remove(existing);
            }
        }
        else
        {
            var value = Math.Clamp(request.Value.Value, 0, 5);
            var existing = await _db.EntityRatings.FindAsync([id], cancellationToken);
            if (existing is null)
            {
                _db.EntityRatings.Add(new EntityRatingRow
                {
                    EntityId = id,
                    Value = value,
                    UpdatedAt = DateTimeOffset.UtcNow
                });
            }
            else
            {
                existing.Value = value;
                existing.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }

        entity.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return await GetCardAsync(id, cancellationToken);
    }

    public async Task<EntityCard?> UpdateFlagsAsync(
        Guid id,
        EntityFlagsUpdateRequest request,
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

        flags.IsFavorite = request.IsFavorite ?? flags.IsFavorite;
        flags.IsNsfw = request.IsNsfw ?? flags.IsNsfw;
        flags.IsOrganized = request.IsOrganized ?? flags.IsOrganized;
        flags.UpdatedAt = DateTimeOffset.UtcNow;
        entity.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return await GetCardAsync(id, cancellationToken);
    }

    public async Task<VideoListResponse> ListVideosAsync(CancellationToken cancellationToken)
    {
        var entities = await ListAsync("video", null, null, cancellationToken);
        return new VideoListResponse(entities.Items, entities.NextCursor);
    }

    public async Task<VideoDetail?> GetVideoAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await _db.Entities
            .AsNoTracking()
            .FirstOrDefaultAsync(
                row => row.Id == id && row.KindCode == "video" && row.DeletedAt == null,
                cancellationToken);

        if (entity is null)
        {
            return null;
        }

        var detail = await _db.VideoDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);
        var card = (await BuildCardsAsync([entity], cancellationToken)).Single();
        var markers = await LoadMarkersAsync(id, cancellationToken);
        var subtitles = await LoadSubtitlesAsync(id, cancellationToken);

        return new VideoDetail(
            entity.Id,
            entity.KindCode,
            entity.Title,
            detail?.Summary,
            detail?.DurationMs is null ? null : TimeSpan.FromMilliseconds(detail.DurationMs.Value),
            detail?.Width,
            detail?.Height,
            markers,
            subtitles,
            card.Capabilities);
    }

    public async Task<VideoSeriesListResponse> ListSeriesAsync(CancellationToken cancellationToken)
    {
        var entities = await ListAsync("video-series", null, null, cancellationToken);
        return new VideoSeriesListResponse(entities.Items, entities.NextCursor);
    }

    public async Task<VideoSeriesDetail?> GetSeriesAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await _db.Entities
            .AsNoTracking()
            .FirstOrDefaultAsync(
                row => row.Id == id && row.KindCode == "video-series" && row.DeletedAt == null,
                cancellationToken);

        if (entity is null)
        {
            return null;
        }

        var card = (await BuildCardsAsync([entity], cancellationToken)).Single();
        var videos = await LoadLinkedChildrenAsync(id, "episode", "video", cancellationToken);

        return new VideoSeriesDetail(
            entity.Id,
            entity.KindCode,
            entity.Title,
            null,
            card.Capabilities,
            [],
            videos,
            videos.Count > 0 ? "seasons" : "flat");
    }

    private async Task<IReadOnlyList<EntityCard>> LoadLinkedChildrenAsync(
        Guid parentId,
        string relationship,
        string? childKind,
        CancellationToken cancellationToken)
    {
        var links = await _db.EntityHierarchyLinks
            .AsNoTracking()
            .Where(link => link.ParentEntityId == parentId && link.Relationship == relationship)
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

        if (!string.IsNullOrWhiteSpace(childKind))
        {
            childQuery = childQuery.Where(entity => entity.KindCode == childKind);
        }

        var childRows = await childQuery.ToListAsync(cancellationToken);
        var childCards = await BuildCardsAsync(childRows, cancellationToken);
        var cardsById = childCards.ToDictionary(card => card.Id);

        return links
            .Where(link => cardsById.ContainsKey(link.ChildEntityId))
            .Select(link => cardsById[link.ChildEntityId])
            .ToArray();
    }

    private async Task<IReadOnlyList<EntityCard>> BuildCardsAsync(
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
        var thumbnails = await LoadFilePathsAsync(ids, "thumbnail", cancellationToken);
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

                return new EntityCard(
                    row.Id,
                    row.KindCode,
                    row.Title,
                    null,
                    new EntityCapabilities(
                        ratings.ContainsKey(row.Id) ? new Rating(rating) : null,
                        tagTitles ?? [],
                        creditRefs ?? [],
                        studio,
                        urlRefs ?? [],
                        externalIdRefs ?? [],
                        thumbnailUrl,
                        null,
                        flag?.IsFavorite,
                        flag?.IsNsfw,
                        flag?.IsOrganized));
            })
            .ToArray();
    }

    private async Task<IReadOnlyList<VideoMarker>> LoadMarkersAsync(
        Guid entityId,
        CancellationToken cancellationToken)
    {
        return await _db.EntityMarkers
            .AsNoTracking()
            .Where(marker => marker.EntityId == entityId)
            .OrderBy(marker => marker.Seconds)
            .ThenBy(marker => marker.Title)
            .Select(marker => new VideoMarker(
                marker.Id,
                marker.Title,
                marker.Seconds,
                marker.EndSeconds))
            .ToArrayAsync(cancellationToken);
    }

    private async Task<IReadOnlyList<VideoSubtitle>> LoadSubtitlesAsync(
        Guid entityId,
        CancellationToken cancellationToken)
    {
        return await _db.EntitySubtitles
            .AsNoTracking()
            .Where(subtitle => subtitle.EntityId == entityId)
            .OrderByDescending(subtitle => subtitle.IsDefault)
            .ThenBy(subtitle => subtitle.Language)
            .ThenBy(subtitle => subtitle.Label)
            .Select(subtitle => new VideoSubtitle(
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
            .Where(entity => tagIds.Contains(entity.Id) && entity.KindCode == "tag")
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
        string role,
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
            .Where(entity => studioIds.Contains(entity.Id) && entity.KindCode == "studio" && entity.DeletedAt == null)
            .ToDictionaryAsync(entity => entity.Id, cancellationToken);

        return links
            .Where(link => studios.ContainsKey(link.StudioId))
            .ToDictionary(
                link => link.EntityId,
                link =>
                {
                    var studio = studios[link.StudioId];
                    return new EntityReference(studio.Id, studio.KindCode, studio.Title);
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
            .Where(entity => personIds.Contains(entity.Id) && entity.KindCode == "performer" && entity.DeletedAt == null)
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
                        return new EntityReference(person.Id, person.KindCode, person.Title);
                    })
                    .ToArray());
    }
}

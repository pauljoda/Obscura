using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;
using Obscura.Domain.Media;
using Obscura.Domain.Taxonomy;
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
        ListAsync(EntityKindRegistry.Video, null, null, cancellationToken);

    /// <inheritdoc />
    public async Task<Video?> GetVideoAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await _db.Entities
            .AsNoTracking()
            .FirstOrDefaultAsync(
                row => row.Id == id && row.KindCode == EntityKindRegistry.Video.Code && row.DeletedAt == null,
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
        ListAsync(EntityKindRegistry.VideoSeries, null, null, cancellationToken);

    /// <inheritdoc />
    public async Task<VideoSeries?> GetSeriesAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await _db.Entities
            .AsNoTracking()
            .FirstOrDefaultAsync(
                row => row.Id == id && row.KindCode == EntityKindRegistry.VideoSeries.Code && row.DeletedAt == null,
                cancellationToken);

        if (entity is null)
        {
            return null;
        }

        var card = (await BuildEntitiesAsync([entity], cancellationToken)).Single();
        var seasons = await LoadLinkedChildrenAsync(id, EntityRelationshipRegistry.Season, EntityKindRegistry.VideoSeason, cancellationToken);
        var videos = await LoadLinkedChildrenAsync(id, EntityRelationshipRegistry.Episode, EntityKindRegistry.Video, cancellationToken);

        return new VideoSeries(
            card,
            null,
            seasons,
            videos,
            seasons.Count > 0 ? VideoSeriesRenderingMode.Seasons : VideoSeriesRenderingMode.Flat);
    }

    /// <summary>
    /// Gets one image aggregate with image-specific detail fields hydrated from v2 storage.
    /// </summary>
    public async Task<Image?> GetImageAggregateAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await GetEntityOfKindAsync(id, EntityKindRegistry.Image, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var detail = await _db.ImageDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);

        return new Image(entity, detail is null
            ? ImageDetails.Empty
            : new ImageDetails(
                detail.Details,
                detail.Date,
                detail.FilePath,
                detail.FileSizeBytes,
                detail.Width,
                detail.Height,
                detail.Format,
                detail.SortOrder));
    }

    /// <summary>
    /// Gets one gallery aggregate with gallery-specific detail fields hydrated from v2 storage.
    /// </summary>
    public async Task<Gallery?> GetGalleryAggregateAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await GetEntityOfKindAsync(id, EntityKindRegistry.Gallery, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var detail = await _db.GalleryDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);

        return new Gallery(entity, detail is null
            ? GalleryDetails.Empty
            : new GalleryDetails(
                detail.Details,
                detail.Date,
                detail.GalleryType,
                detail.FolderPath,
                detail.ZipFilePath,
                detail.Photographer,
                detail.CoverImageEntityId,
                detail.ImageCount));
    }

    /// <summary>
    /// Gets one book aggregate with book details and single-user read progress.
    /// </summary>
    public async Task<Book?> GetBookAggregateAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await GetEntityOfKindAsync(id, EntityKindRegistry.Book, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var detail = await _db.BookDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);
        var progress = await _db.BookReadProgress
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.BookEntityId == id, cancellationToken);

        return new Book(
            entity,
            detail is null
                ? BookDetails.Empty
                : new BookDetails(
                    detail.BookType,
                    detail.SortTitle,
                    detail.Summary,
                    detail.Date,
                    detail.FolderPath,
                    detail.RelativePath,
                    detail.CoverPageEntityId,
                    detail.CoverImagePath,
                    detail.PageCount,
                    detail.ChapterCount),
            progress is null
                ? BookReadProgress.Empty
                : new BookReadProgress(
                    progress.ChapterEntityId,
                    progress.PageIndex,
                    progress.PageCount,
                    progress.ReaderMode,
                    progress.CompletedAt));
    }

    /// <summary>
    /// Gets one audio library aggregate with audio-library-specific detail fields.
    /// </summary>
    public async Task<AudioLibrary?> GetAudioLibraryAggregateAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await GetEntityOfKindAsync(id, EntityKindRegistry.AudioLibrary, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var detail = await _db.AudioLibraryDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);

        return new AudioLibrary(entity, detail is null
            ? AudioLibraryDetails.Empty
            : new AudioLibraryDetails(
                detail.Details,
                detail.Date,
                detail.FolderPath,
                detail.ParentLibraryEntityId,
                detail.TrackCount));
    }

    /// <summary>
    /// Gets one audio track aggregate with technical probe details and playback capability state.
    /// </summary>
    public async Task<AudioTrack?> GetAudioTrackAggregateAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await GetEntityOfKindAsync(id, EntityKindRegistry.AudioTrack, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var detail = await _db.AudioTrackDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);

        return new AudioTrack(entity, detail is null
            ? AudioTrackDetails.Empty
            : new AudioTrackDetails(
                detail.Details,
                detail.Date,
                detail.DurationSeconds is null ? null : TimeSpan.FromSeconds(detail.DurationSeconds.Value),
                detail.BitRate,
                detail.SampleRate,
                detail.Channels,
                detail.Codec,
                detail.Container,
                detail.EmbeddedArtist,
                detail.EmbeddedAlbum,
                detail.TrackNumber,
                detail.WaveformPath));
    }

    /// <summary>
    /// Gets one person taxonomy aggregate with person-specific descriptive detail fields.
    /// </summary>
    public async Task<Person?> GetPersonAggregateAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await GetEntityOfKindAsync(id, EntityKindRegistry.Person, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var detail = await _db.PersonDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);

        return new Person(entity, detail is null
            ? PersonDetails.Empty
            : new PersonDetails(
                detail.Disambiguation,
                detail.Gender,
                detail.Birthdate,
                detail.Country,
                detail.Ethnicity,
                detail.EyeColor,
                detail.HairColor,
                detail.Height,
                detail.Weight,
                detail.Measurements,
                detail.Tattoos,
                detail.Piercings,
                detail.CareerStart,
                detail.CareerEnd,
                detail.Details));
    }

    /// <summary>
    /// Gets one studio taxonomy aggregate with hierarchy metadata.
    /// </summary>
    public async Task<Studio?> GetStudioAggregateAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await GetEntityOfKindAsync(id, EntityKindRegistry.Studio, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var detail = await _db.StudioDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);

        return new Studio(entity, detail is null
            ? StudioDetails.Empty
            : new StudioDetails(detail.Description, detail.ParentStudioEntityId));
    }

    /// <summary>
    /// Gets one tag taxonomy aggregate with hierarchy and automation metadata.
    /// </summary>
    public async Task<Tag?> GetTagAggregateAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await GetEntityOfKindAsync(id, EntityKindRegistry.Tag, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var detail = await _db.TagDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);

        return new Tag(entity, detail is null
            ? TagDetails.Empty
            : new TagDetails(detail.Description, detail.ParentTagEntityId, detail.IgnoreAutoTag));
    }

    /// <summary>
    /// Gets one collection aggregate with collection-specific detail fields and ordered member projections.
    /// </summary>
    public async Task<Collection?> GetCollectionAggregateAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await GetEntityOfKindAsync(id, EntityKindRegistry.Collection, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var detail = await _db.CollectionDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);
        var items = await LoadLinkedChildrenAsync(id, EntityRelationshipRegistry.CollectionItem, null, cancellationToken);

        return new Collection(
            entity,
            detail is null
                ? CollectionDetails.Empty
                : new CollectionDetails(
                    detail.Description,
                    detail.Mode,
                    detail.RuleTreeJson,
                    detail.ItemCount,
                    detail.CoverMode,
                    detail.CoverImagePath,
                    detail.CoverItemEntityId,
                    TimeSpan.FromSeconds(detail.SlideshowDurationSeconds),
                    detail.SlideshowAutoAdvance,
                    detail.LastRefreshedAt),
            items);
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
        var tags = await LoadTagReferencesAsync(ids, cancellationToken);
        var files = await LoadFilesAsync(ids, cancellationToken);
        var playback = await LoadPlaybackAsync(ids, cancellationToken);
        var studios = await LoadStudioReferencesAsync(ids, cancellationToken);
        var credits = await LoadCreditReferencesAsync(ids, cancellationToken);
        var urls = await LoadUrlsAsync(ids, cancellationToken);
        var externalIds = await LoadExternalIdsAsync(ids, cancellationToken);

        return rows
            .Select(row =>
            {
                ratings.TryGetValue(row.Id, out var rating);
                flags.TryGetValue(row.Id, out var flag);
                tags.TryGetValue(row.Id, out var tagRefs);
                files.TryGetValue(row.Id, out var fileRefs);
                playback.TryGetValue(row.Id, out var playbackState);
                studios.TryGetValue(row.Id, out var studio);
                credits.TryGetValue(row.Id, out var creditRefs);
                urls.TryGetValue(row.Id, out var urlRefs);
                externalIds.TryGetValue(row.Id, out var externalIdRefs);

                return new Entity(
                    row.Id,
                    ResolveKind(row.KindCode),
                    row.Title,
                    null,
                    BuildExplicitCapabilities(
                        ratings.ContainsKey(row.Id) ? Rating.FromNullable(rating) : null,
                        tagRefs ?? [],
                        creditRefs ?? [],
                        studio,
                        fileRefs ?? [],
                        playbackState,
                        urlRefs ?? [],
                        externalIdRefs ?? [],
                        flag));
            })
            .ToArray();
    }

    private static IReadOnlyList<ICapability> BuildExplicitCapabilities(
        Rating? rating,
        IReadOnlyList<EntityTag> tags,
        IReadOnlyList<EntityCredit> credits,
        EntityReference? studio,
        IReadOnlyList<EntityFile> files,
        Playback? playback,
        IReadOnlyList<EntityUrl> urls,
        IReadOnlyList<EntityExternalId> externalIds,
        EntityFlagRow? flag)
    {
        var capabilities = new List<ICapability>
        {
            new CapabilityRating(rating),
            new CapabilityTags(tags),
            new CapabilityCredits(credits),
            new CapabilityStudio(studio),
            new CapabilityImages(files.FirstOrDefault(file => file.Role == EntityFileRole.Thumbnail)?.Path, null),
            new CapabilityLinks(urls, externalIds),
            new CapabilityFlags(flag?.IsFavorite, flag?.IsNsfw, flag?.IsOrganized),
            new CapabilityFiles(files)
        };

        if (playback is not null)
        {
            capabilities.Add(new CapabilityPlayback(playback));
        }

        return capabilities;
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

    private async Task<IReadOnlyDictionary<Guid, Playback>> LoadPlaybackAsync(
        IReadOnlyList<Guid> entityIds,
        CancellationToken cancellationToken)
    {
        return await _db.EntityPlayback
            .AsNoTracking()
            .Where(row => entityIds.Contains(row.EntityId))
            .ToDictionaryAsync(
                row => row.EntityId,
                row => new Playback(
                    row.PlayCount,
                    TimeSpan.FromSeconds(row.PlayDurationSeconds),
                    TimeSpan.FromSeconds(row.ResumeSeconds),
                    row.LastPlayedAt,
                    row.CompletedAt),
                cancellationToken);
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

        return links
            .Where(link => people.ContainsKey(link.PersonEntityId))
            .GroupBy(link => link.EntityId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<EntityCredit>)group
                    .Select(link =>
                    {
                        var person = people[link.PersonEntityId];
                        return new EntityCredit(
                            new EntityReference(person.Id, ResolveKind(person.KindCode), person.Title),
                            link.Role,
                            link.Character);
                    })
                    .ToArray());
    }

    private static IEntityKind ResolveKind(string code) => EntityKindRegistry.Require(code);

    private async Task<Entity?> GetEntityOfKindAsync(
        Guid id,
        IEntityKind kind,
        CancellationToken cancellationToken)
    {
        var entity = await GetAsync(id, cancellationToken);
        if (entity is null || !string.Equals(entity.Kind.Code, kind.Code, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return entity;
    }

    private sealed record LinkedEntity(Entity Entity, IEntityRelationship Relationship, int SortOrder);
}

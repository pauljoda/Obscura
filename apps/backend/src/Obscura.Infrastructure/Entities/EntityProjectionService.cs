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
public sealed partial class EntityProjectionService : IEntityCatalog, IEntityDetails, IEntityHierarchy, IRatingService, IVideoLibrary
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
        bool hideNsfw,
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

        if (hideNsfw)
        {
            entityQuery = entityQuery.Where(entity =>
                !_db.EntityFlags.Any(flag => flag.EntityId == entity.Id && flag.IsNsfw));
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
            var rating = new Rating(value.Value).Value;
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
    public async Task<Entity?> UpdatePlaybackAsync(
        Guid id,
        double? resumeSeconds,
        double? durationSeconds,
        bool? completed,
        CancellationToken cancellationToken)
    {
        var entity = await _db.Entities
            .FirstOrDefaultAsync(row => row.Id == id && row.DeletedAt == null, cancellationToken);

        if (entity is null)
        {
            return null;
        }

        var playback = await _db.EntityPlayback.FindAsync([id], cancellationToken);
        var now = DateTimeOffset.UtcNow;

        if (playback is null)
        {
            playback = new EntityPlaybackRow
            {
                EntityId = id,
                PlayCount = 1,
                LastPlayedAt = now,
                UpdatedAt = now
            };
            _db.EntityPlayback.Add(playback);
        }
        else
        {
            playback.LastPlayedAt = now;
        }

        if (resumeSeconds.HasValue)
        {
            playback.ResumeSeconds = Math.Max(0, resumeSeconds.Value);
        }

        if (durationSeconds.HasValue && durationSeconds.Value > 0)
        {
            playback.PlayDurationSeconds += durationSeconds.Value;
        }

        if (completed == true)
        {
            playback.CompletedAt = now;
            playback.ResumeSeconds = 0;
        }
        else if (completed == false)
        {
            playback.CompletedAt = null;
        }

        playback.UpdatedAt = now;
        entity.UpdatedAt = now;
        await _db.SaveChangesAsync(cancellationToken);

        return await GetAsync(id, cancellationToken);
    }

    /// <inheritdoc />
    public Task<EntityPage> ListVideosAsync(bool hideNsfw, CancellationToken cancellationToken) =>
        ListAsync(EntityKindRegistry.Video, null, null, hideNsfw, cancellationToken);

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

        return new Video(card, detail?.SubtitlesExtractedAt);
    }

    /// <inheritdoc />
    public Task<EntityPage> ListSeriesAsync(bool hideNsfw, CancellationToken cancellationToken) =>
        ListAsync(EntityKindRegistry.VideoSeries, null, null, hideNsfw, cancellationToken);

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
        var detail = await _db.VideoSeriesDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);
        var seasons = await LoadLinkedChildrenAsync(id, EntityRelationshipRegistry.Season, EntityKindRegistry.VideoSeason, cancellationToken);
        var videos = await LoadLinkedChildrenAsync(id, EntityRelationshipRegistry.Episode, EntityKindRegistry.Video, cancellationToken);
        var renderingMode = detail?.RenderingMode ??
            (seasons.Count > 0 ? VideoSeriesRenderingMode.Seasons : VideoSeriesRenderingMode.Flat);

        return new VideoSeries(card, detail?.Status, renderingMode, seasons, videos);
    }
}

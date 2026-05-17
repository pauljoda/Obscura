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
public sealed partial class EntityProjectionService :
    IEntityCatalog,
    IEntityDetails,
    IRatingService,
    IEntityMarkerService,
    IVideoLibrary
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

        return (await BuildEntitiesAsync([row], cancellationToken, includeChildren: true)).Single();
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<Entity>> ListChildrenAsync(
        Guid parentId,
        IEntityKind? childKind,
        CancellationToken cancellationToken)
    {
        var links = await _db.EntityChildLinks
            .AsNoTracking()
            .Where(link => link.ParentEntityId == parentId)
            .Where(link => childKind == null || link.ChildKindCode == childKind.Code)
            .ToListAsync(cancellationToken);
        if (links.Count == 0)
        {
            return [];
        }

        var childIds = links.Select(link => link.ChildEntityId).ToArray();
        var childRows = await _db.Entities
            .AsNoTracking()
            .Where(entity => childIds.Contains(entity.Id) && entity.DeletedAt == null)
            .ToListAsync(cancellationToken);
        var childRowsById = childRows.ToDictionary(entity => entity.Id);
        var childCards = (await BuildEntitiesAsync(childRows, cancellationToken))
            .ToDictionary(entity => entity.Id);

        return links
            .Where(link => childCards.ContainsKey(link.ChildEntityId))
            .OrderBy(link => link.ChildKindCode)
            .ThenBy(link => link.SortOrder)
            .ThenBy(link => childRowsById[link.ChildEntityId].CreatedAt)
            .ThenBy(link => link.ChildEntityId)
            .Select(link => childCards[link.ChildEntityId])
            .ToArray();
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
    public async Task<Entity?> CreateMarkerAsync(
        Guid id,
        string title,
        double seconds,
        double? endSeconds,
        CancellationToken cancellationToken)
    {
        var entity = await _db.Entities
            .FirstOrDefaultAsync(row => row.Id == id && row.DeletedAt == null, cancellationToken);

        if (entity is null)
        {
            return null;
        }

        var now = DateTimeOffset.UtcNow;
        _db.EntityMarkers.Add(new EntityMarkerRow
        {
            Id = Guid.NewGuid(),
            EntityId = id,
            Title = NormalizeMarkerTitle(title),
            Seconds = NormalizeMarkerSeconds(seconds),
            EndSeconds = NormalizeOptionalMarkerSeconds(endSeconds),
            CreatedAt = now,
            UpdatedAt = now
        });

        entity.UpdatedAt = now;
        await _db.SaveChangesAsync(cancellationToken);

        return await GetAsync(id, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<Entity?> UpdateMarkerAsync(
        Guid id,
        Guid markerId,
        string title,
        double seconds,
        double? endSeconds,
        CancellationToken cancellationToken)
    {
        var entity = await _db.Entities
            .FirstOrDefaultAsync(row => row.Id == id && row.DeletedAt == null, cancellationToken);

        if (entity is null)
        {
            return null;
        }

        var marker = await _db.EntityMarkers
            .FirstOrDefaultAsync(row => row.Id == markerId && row.EntityId == id, cancellationToken);

        if (marker is not null)
        {
            var now = DateTimeOffset.UtcNow;
            marker.Title = NormalizeMarkerTitle(title);
            marker.Seconds = NormalizeMarkerSeconds(seconds);
            marker.EndSeconds = NormalizeOptionalMarkerSeconds(endSeconds);
            marker.UpdatedAt = now;
            entity.UpdatedAt = now;
            await _db.SaveChangesAsync(cancellationToken);
        }

        return await GetAsync(id, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<Entity?> DeleteMarkerAsync(
        Guid id,
        Guid markerId,
        CancellationToken cancellationToken)
    {
        var entity = await _db.Entities
            .FirstOrDefaultAsync(row => row.Id == id && row.DeletedAt == null, cancellationToken);

        if (entity is null)
        {
            return null;
        }

        var marker = await _db.EntityMarkers
            .FirstOrDefaultAsync(row => row.Id == markerId && row.EntityId == id, cancellationToken);

        if (marker is not null)
        {
            _db.EntityMarkers.Remove(marker);
            entity.UpdatedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);
        }

        return await GetAsync(id, cancellationToken);
    }

    private static string NormalizeMarkerTitle(string title)
    {
        var normalized = title.Trim();
        return string.IsNullOrWhiteSpace(normalized) ? "Marker" : normalized;
    }

    private static double NormalizeMarkerSeconds(double seconds) =>
        double.IsFinite(seconds) ? Math.Max(0, seconds) : 0;

    private static double? NormalizeOptionalMarkerSeconds(double? seconds) =>
        seconds.HasValue ? NormalizeMarkerSeconds(seconds.Value) : null;

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
        var card = (await BuildEntitiesAsync([entity], cancellationToken, includeChildren: true)).Single();

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

        var card = (await BuildEntitiesAsync([entity], cancellationToken, includeChildren: true)).Single();
        var detail = await _db.VideoSeriesDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);
        var seasons = card.ChildrenByKind.Get(EntityKindRegistry.VideoSeason).Cast<Entity>().ToArray();
        var videos = card.ChildrenByKind.Get(EntityKindRegistry.Video).Cast<Entity>().ToArray();
        var renderingMode = detail?.RenderingMode ??
            (seasons.Length > 0 ? VideoSeriesRenderingMode.Seasons : VideoSeriesRenderingMode.Flat);

        return new VideoSeries(card, detail?.Status, renderingMode, seasons, videos);
    }

    /// <inheritdoc />
    public async Task<VideoSeason?> GetSeasonAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await _db.Entities
            .AsNoTracking()
            .FirstOrDefaultAsync(
                row => row.Id == id && row.KindCode == EntityKindRegistry.VideoSeason.Code && row.DeletedAt == null,
                cancellationToken);

        if (entity is null)
        {
            return null;
        }

        var card = (await BuildEntitiesAsync([entity], cancellationToken, includeChildren: true)).Single();
        var videos = card.ChildrenByKind.Get(EntityKindRegistry.Video).Cast<Entity>().ToArray();

        return new VideoSeason(card, card.ParentEntityId, videos);
    }
}

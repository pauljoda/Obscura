using Microsoft.EntityFrameworkCore;
using Obscura.Application.Entities;
using Obscura.Contracts.Entities;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Entities.Mappers;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities;

/// <summary>
/// EF Core adapter for <see cref="IEntityReadService"/>. Card and detail reads flow
/// through the hydrated domain entity and <see cref="EntityCardProjector"/>; the
/// browse and thumbnail path stays a deliberate row-optimized projection so list
/// pages do not pay the full hydration cost. Kind-specific detail DTO projection is
/// delegated to <see cref="IEntityKindMapper.ProjectDetail"/> so this service stays a
/// coordinator and never branches on a concrete entity kind.
/// </summary>
public sealed class EfEntityReadService : IEntityReadService {
    private const int PageSize = 60;

    private readonly ObscuraDbContext _db;
    private readonly EfEntityRepository _repository;
    private readonly IReadOnlyDictionary<EntityKind, IEntityKindMapper> _kindMappers;

    public EfEntityReadService(
        ObscuraDbContext db,
        EfEntityRepository repository,
        IEnumerable<IEntityKindMapper> kindMappers) {
        _db = db;
        _repository = repository;
        _kindMappers = kindMappers.ToDictionary(mapper => mapper.Kind);
    }

    public async Task<EntityListResponse> ListAsync(
        string? kind,
        string? query,
        string? cursor,
        bool? hideNsfw,
        CancellationToken cancellationToken) {
        var entityQuery = _db.Entities.AsNoTracking()
            .Where(entity => entity.DeletedAt == null);

        if (!string.IsNullOrWhiteSpace(kind)) {
            entityQuery = entityQuery.Where(entity => entity.KindCode == kind);
        }

        if (!string.IsNullOrWhiteSpace(query)) {
            var normalized = query.Trim().ToLower();
            entityQuery = entityQuery.Where(entity => entity.Title.ToLower().Contains(normalized));
        }

        if (hideNsfw == true) {
            entityQuery =
                from entity in entityQuery
                join flag in _db.EntityFlags.AsNoTracking() on entity.Id equals flag.EntityId into flags
                from flag in flags.DefaultIfEmpty()
                where flag == null || !flag.IsNsfw
                select entity;
        }

        if (TryDecodeCursor(cursor, out var cursorTitle, out var cursorId)) {
            entityQuery = entityQuery.Where(entity =>
                string.Compare(entity.Title, cursorTitle) > 0 ||
                (entity.Title == cursorTitle && entity.Id.CompareTo(cursorId) > 0));
        }

        var rows = await entityQuery
            .OrderBy(entity => entity.Title)
            .ThenBy(entity => entity.Id)
            .Take(PageSize + 1)
            .ToArrayAsync(cancellationToken);

        var page = rows.Take(PageSize).ToArray();
        var thumbnails = await ProjectThumbnailsAsync(page, cancellationToken);
        var nextCursor = rows.Length > PageSize ? EncodeCursor(page[^1].Title, page[^1].Id) : null;
        return new EntityListResponse(thumbnails, nextCursor);
    }

    public async Task<EntityCard?> GetAsync(Guid id, CancellationToken cancellationToken) {
        var entity = await _repository.FindAsync(id, cancellationToken);
        return entity is null ? null : EntityCardProjector.ToCard(entity);
    }

    public async Task<EntityThumbnailBatchResponse> GetThumbnailsAsync(IReadOnlyList<Guid> ids, CancellationToken cancellationToken) {
        var rows = await _db.Entities.AsNoTracking()
            .Where(entity => ids.Contains(entity.Id) && entity.DeletedAt == null)
            .ToArrayAsync(cancellationToken);
        var thumbnails = await ProjectThumbnailsAsync(rows, cancellationToken);
        var byId = thumbnails.ToDictionary(item => item.Id);
        return new EntityThumbnailBatchResponse(ids.Where(byId.ContainsKey).Select(id => byId[id]).ToArray());
    }

    public async Task<IEntityCard?> GetDetailAsync(Guid id, string kind, CancellationToken cancellationToken) {
        var entity = await _repository.FindAsync(id, cancellationToken);
        if (entity is null) {
            return null;
        }

        var card = EntityCardProjector.ToCard(entity);
        if (!card.Kind.Equals(kind, StringComparison.OrdinalIgnoreCase)) {
            return null;
        }

        var creditMetadata = EntityCardProjector.CreditMetadata(entity);
        return _kindMappers.TryGetValue(entity.Kind, out var mapper)
            ? mapper.ProjectDetail(entity, card, creditMetadata)
            : card;
    }

    private async Task<IReadOnlyList<EntityThumbnail>> ProjectThumbnailsAsync(
        IReadOnlyList<EntityRow> rows,
        CancellationToken cancellationToken) {
        if (rows.Count == 0) {
            return [];
        }

        var ids = rows.Select(entity => entity.Id).ToArray();
        var ratings = await _db.EntityRatings.AsNoTracking()
            .Where(rating => ids.Contains(rating.EntityId))
            .ToDictionaryAsync(rating => rating.EntityId, rating => rating.Value, cancellationToken);
        var flags = await _db.EntityFlags.AsNoTracking()
            .Where(flag => ids.Contains(flag.EntityId))
            .ToDictionaryAsync(flag => flag.EntityId, cancellationToken);
        var covers = await _db.EntityFiles.AsNoTracking()
            .Where(file => ids.Contains(file.EntityId))
            .Where(file => file.Role == EntityFileRole.Thumbnail || file.Role == EntityFileRole.Poster || file.Role == EntityFileRole.Cover || file.Role == EntityFileRole.Backdrop)
            .OrderBy(file => file.Role == EntityFileRole.Thumbnail ? 0 :
                file.Role == EntityFileRole.Poster ? 1 :
                file.Role == EntityFileRole.Cover ? 2 : 3)
            .ThenBy(file => file.CreatedAt)
            .ToArrayAsync(cancellationToken);
        var coverByEntity = covers
            .GroupBy(file => file.EntityId)
            .ToDictionary(group => group.Key, group => group.First().Path);

        return rows.Select(row => {
            flags.TryGetValue(row.Id, out var flag);
            return new EntityThumbnail(
                row.Id,
                row.KindCode,
                row.Title,
                row.ParentEntityId,
                row.SortOrder,
                coverByEntity.GetValueOrDefault(row.Id),
                "none",
                null,
                [],
                ratings.GetValueOrDefault(row.Id),
                flag?.IsFavorite ?? false,
                flag?.IsNsfw ?? false,
                flag?.IsOrganized ?? false);
        }).ToArray();
    }

    private static string EncodeCursor(string title, Guid id) =>
        Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"{title}\n{id:N}"));

    private static bool TryDecodeCursor(string? cursor, out string title, out Guid id) {
        title = string.Empty;
        id = Guid.Empty;
        if (string.IsNullOrWhiteSpace(cursor)) {
            return false;
        }

        try {
            var parts = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(cursor)).Split('\n');
            return parts.Length == 2 && Guid.TryParseExact(parts[1], "N", out id) && !string.IsNullOrWhiteSpace(title = parts[0]);
        } catch (FormatException) {
            return false;
        }
    }
}

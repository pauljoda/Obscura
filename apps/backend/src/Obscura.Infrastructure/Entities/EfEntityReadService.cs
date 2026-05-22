using System.Text.Json;
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
    private const int DefaultPageSize = 250;
    private const int MaxPageSize = 1000;

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
        int? limit,
        CancellationToken cancellationToken) {
        var pageSize = Math.Clamp(limit ?? DefaultPageSize, 1, MaxPageSize);
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

        // Snapshot the unbounded filtered total before applying the cursor; this is what
        // drives the client's page-of-pages and seek-to-end behaviour and must stay
        // independent of where in the cursor sequence we currently are.
        var totalCount = await entityQuery.CountAsync(cancellationToken);

        if (TryDecodeCursor(cursor, out var cursorTitle, out var cursorId)) {
            entityQuery = entityQuery.Where(entity =>
                string.Compare(entity.Title, cursorTitle) > 0 ||
                (entity.Title == cursorTitle && entity.Id.CompareTo(cursorId) > 0));
        }

        var rows = await entityQuery
            .OrderBy(entity => entity.Title)
            .ThenBy(entity => entity.Id)
            .Take(pageSize + 1)
            .ToArrayAsync(cancellationToken);

        var page = rows.Take(pageSize).ToArray();
        var thumbnails = await ProjectThumbnailsAsync(page, cancellationToken);
        var nextCursor = rows.Length > pageSize ? EncodeCursor(page[^1].Title, page[^1].Id) : null;
        return new EntityListResponse(thumbnails, nextCursor, totalCount);
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

        var card = EntityCardProjector.ToCard(entity) with {
            Relationships = await ProjectRelationshipGroupsAsync(id, cancellationToken)
        };
        if (!card.Kind.Equals(kind, StringComparison.OrdinalIgnoreCase)) {
            return null;
        }

        var creditMetadata = await ProjectCreditMetadataAsync(id, cancellationToken);
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
        var hoverFiles = await _db.EntityFiles.AsNoTracking()
            .Where(file => ids.Contains(file.EntityId) && file.Role == EntityFileRole.Trickplay)
            .Where(file => file.Path.EndsWith(".m3u8") || file.Path.EndsWith(".vtt"))
            .OrderByDescending(file => file.Path.EndsWith(".m3u8"))
            .ThenBy(file => file.CreatedAt)
            .ToArrayAsync(cancellationToken);
        var hoverByEntity = hoverFiles
            .GroupBy(file => file.EntityId)
            .ToDictionary(group => group.Key, group => group.First().Path);

        return rows.Select(row => {
            flags.TryGetValue(row.Id, out var flag);
            var hoverUrl = hoverByEntity.GetValueOrDefault(row.Id);
            return new EntityThumbnail(
                row.Id,
                row.KindCode,
                row.Title,
                row.ParentEntityId,
                row.SortOrder,
                coverByEntity.GetValueOrDefault(row.Id),
                hoverUrl is null ? "none" : "sprite",
                hoverUrl,
                [],
                ratings.GetValueOrDefault(row.Id),
                flag?.IsFavorite ?? false,
                flag?.IsNsfw ?? false,
                flag?.IsOrganized ?? false);
        }).ToArray();
    }

    private async Task<IReadOnlyList<EntityGroup>> ProjectRelationshipGroupsAsync(
        Guid entityId,
        CancellationToken cancellationToken) {
        var links = await _db.EntityRelationshipLinks.AsNoTracking()
            .Where(link => link.EntityId == entityId)
            .OrderBy(link => link.RelationshipCode)
            .ThenBy(link => link.SortOrder)
            .ThenBy(link => link.TargetEntityId)
            .ToArrayAsync(cancellationToken);
        if (links.Length == 0) {
            return [];
        }

        var targetIds = links.Select(link => link.TargetEntityId).Distinct().ToArray();
        var targetRows = await _db.Entities.AsNoTracking()
            .Where(entity => targetIds.Contains(entity.Id) && entity.DeletedAt == null)
            .ToDictionaryAsync(entity => entity.Id, cancellationToken);

        var groups = new List<EntityGroup>();
        foreach (var group in links.GroupBy(link => new { link.RelationshipCode, link.TargetKindCode })) {
            var orderedRows = group
                .Select(link => targetRows.GetValueOrDefault(link.TargetEntityId))
                .Where(row => row is not null)
                .Select(row => row!)
                .ToArray();
            if (orderedRows.Length == 0) {
                continue;
            }

            groups.Add(new EntityGroup(
                group.Key.TargetKindCode,
                RelationshipLabel(group.Key.RelationshipCode),
                await ProjectThumbnailsAsync(orderedRows, cancellationToken)) {
                Code = group.Key.RelationshipCode
            });
        }

        return groups;
    }

    private async Task<IReadOnlyList<EntityCreditMetadata>> ProjectCreditMetadataAsync(
        Guid entityId,
        CancellationToken cancellationToken) {
        var links = await _db.EntityRelationshipLinks.AsNoTracking()
            .Where(link => link.EntityId == entityId &&
                           link.RelationshipCode == "cast" &&
                           link.TargetKindCode == EntityKindRegistry.Person.Code)
            .OrderBy(link => link.SortOrder)
            .ThenBy(link => link.TargetEntityId)
            .ToArrayAsync(cancellationToken);

        return links
            .Select(link => {
                var metadata = DecodeCreditMetadata(link.MetadataJson);
                return new EntityCreditMetadata(
                    link.TargetEntityId,
                    metadata.Role,
                    metadata.Character);
            })
            .ToArray();
    }

    private static (string? Role, string? Character) DecodeCreditMetadata(string? metadataJson) {
        if (string.IsNullOrWhiteSpace(metadataJson)) {
            return (null, null);
        }

        try {
            using var document = JsonDocument.Parse(metadataJson);
            var root = document.RootElement;
            return (
                TryGetString(root, "role"),
                TryGetString(root, "character"));
        } catch (JsonException) {
            return (null, null);
        }
    }

    private static string? TryGetString(JsonElement root, string propertyName) =>
        root.TryGetProperty(propertyName, out var property) && property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;

    private static string RelationshipLabel(string code) =>
        code switch {
            "cast" => "Cast",
            "studio" => "Studios",
            "tags" => "Tags",
            "related" => "Related",
            _ => code.Replace('-', ' ')
        };

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

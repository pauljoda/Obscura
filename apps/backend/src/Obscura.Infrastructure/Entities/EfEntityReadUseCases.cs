using Microsoft.EntityFrameworkCore;
using Obscura.Application.Entities;
using Obscura.Contracts.Collections;
using Obscura.Contracts.Entities;
using Obscura.Contracts.Media;
using Obscura.Contracts.Series;
using Obscura.Contracts.Taxonomy;
using Obscura.Contracts.Videos;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities;

/// <summary>
/// EF-projected read model for entity browse and detail API routes.
/// </summary>
public sealed class EfEntityReadUseCases(ObscuraDbContext db) : IEntityReadUseCases
{
    private const int PageSize = 60;

    public async Task<object> ListAsync(
        string? kind,
        string? query,
        string? cursor,
        bool? hideNsfw,
        CancellationToken cancellationToken)
    {
        var entityQuery = db.Entities.AsNoTracking()
            .Where(entity => entity.DeletedAt == null);

        if (!string.IsNullOrWhiteSpace(kind))
        {
            entityQuery = entityQuery.Where(entity => entity.KindCode == kind);
        }

        if (!string.IsNullOrWhiteSpace(query))
        {
            var normalized = query.Trim().ToLower();
            entityQuery = entityQuery.Where(entity => entity.Title.ToLower().Contains(normalized));
        }

        if (hideNsfw == true)
        {
            entityQuery =
                from entity in entityQuery
                join flag in db.EntityFlags.AsNoTracking() on entity.Id equals flag.EntityId into flags
                from flag in flags.DefaultIfEmpty()
                where flag == null || !flag.IsNsfw
                select entity;
        }

        if (TryDecodeCursor(cursor, out var cursorTitle, out var cursorId))
        {
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

    public async Task<object?> GetAsync(Guid id, CancellationToken cancellationToken) =>
        await ProjectCardAsync(id, cancellationToken);

    public async Task<object> GetThumbnailsAsync(IReadOnlyList<Guid> ids, CancellationToken cancellationToken)
    {
        var rows = await db.Entities.AsNoTracking()
            .Where(entity => ids.Contains(entity.Id) && entity.DeletedAt == null)
            .ToArrayAsync(cancellationToken);
        var thumbnails = await ProjectThumbnailsAsync(rows, cancellationToken);
        var byId = thumbnails.ToDictionary(item => item.Id);
        return new EntityThumbnailBatchResponse(ids.Where(byId.ContainsKey).Select(id => byId[id]).ToArray());
    }

    public async Task<object?> GetDetailAsync(Guid id, string kind, CancellationToken cancellationToken)
    {
        var card = await ProjectCardAsync(id, cancellationToken);
        if (card is null || !card.Kind.Equals(kind, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var creditMetadata = await GetCreditMetadataAsync(id, cancellationToken);
        return kind switch
        {
            "video" => new VideoDetail(card.Id, card.Kind, card.Title, card.ParentEntityId, card.SortOrder, card.Capabilities, card.ChildrenByKind, card.Relationships, creditMetadata, null),
            "series" => new VideoSeriesDetail(card.Id, card.Kind, card.Title, card.ParentEntityId, card.SortOrder, card.Capabilities, card.ChildrenByKind, card.Relationships, creditMetadata),
            "season" => new VideoSeasonDetail(card.Id, card.Kind, card.Title, card.ParentEntityId, card.SortOrder, card.Capabilities, card.ChildrenByKind, card.Relationships),
            "image" => new ImageDetail(card.Id, card.Kind, card.Title, card.ParentEntityId, card.SortOrder, card.Capabilities, card.ChildrenByKind, card.Relationships),
            "gallery" => new GalleryDetail(card.Id, card.Kind, card.Title, card.ParentEntityId, card.SortOrder, card.Capabilities, card.ChildrenByKind, card.Relationships, creditMetadata, "folder", null),
            "book" => new BookDetail(card.Id, card.Kind, card.Title, card.ParentEntityId, card.SortOrder, card.Capabilities, card.ChildrenByKind, card.Relationships, "book", null),
            "audio-library" => new AudioLibraryDetail(card.Id, card.Kind, card.Title, card.ParentEntityId, card.SortOrder, card.Capabilities, card.ChildrenByKind, card.Relationships),
            "audio-track" => new AudioTrackDetail(card.Id, card.Kind, card.Title, card.ParentEntityId, card.SortOrder, card.Capabilities, card.ChildrenByKind, card.Relationships, null, null),
            "person" => new PersonDetail(card.Id, card.Kind, card.Title, card.ParentEntityId, card.SortOrder, card.Capabilities, card.ChildrenByKind, card.Relationships, null, null, null, null, null, null, null, null, null, null, null, null, null, null),
            "studio" => new StudioDetail(card.Id, card.Kind, card.Title, card.ParentEntityId, card.SortOrder, card.Capabilities, card.ChildrenByKind, card.Relationships),
            "tag" => new TagDetail(card.Id, card.Kind, card.Title, card.ParentEntityId, card.SortOrder, card.Capabilities, card.ChildrenByKind, card.Relationships, false),
            "collection" => new CollectionDetail(card.Id, card.Kind, card.Title, card.ParentEntityId, card.SortOrder, card.Capabilities, card.ChildrenByKind, card.Relationships),
            _ => card
        };
    }

    private async Task<EntityCard?> ProjectCardAsync(Guid id, CancellationToken cancellationToken)
    {
        var row = await db.Entities.AsNoTracking()
            .FirstOrDefaultAsync(entity => entity.Id == id && entity.DeletedAt == null, cancellationToken);
        if (row is null)
        {
            return null;
        }

        var capabilities = await ProjectCapabilitiesAsync([row.Id], cancellationToken);
        return new EntityCard(
            row.Id,
            row.KindCode,
            row.Title,
            row.ParentEntityId,
            row.SortOrder,
            capabilities.TryGetValue(row.Id, out var caps) ? caps : [],
            await ProjectChildGroupsAsync(row.Id, cancellationToken),
            await ProjectRelationshipGroupsAsync(row.Id, cancellationToken));
    }

    private async Task<IReadOnlyList<EntityThumbnail>> ProjectThumbnailsAsync(
        IReadOnlyList<EntityRow> rows,
        CancellationToken cancellationToken)
    {
        if (rows.Count == 0)
        {
            return [];
        }

        var ids = rows.Select(entity => entity.Id).ToArray();
        var ratings = await db.EntityRatings.AsNoTracking()
            .Where(rating => ids.Contains(rating.EntityId))
            .ToDictionaryAsync(rating => rating.EntityId, rating => rating.Value, cancellationToken);
        var flags = await db.EntityFlags.AsNoTracking()
            .Where(flag => ids.Contains(flag.EntityId))
            .ToDictionaryAsync(flag => flag.EntityId, cancellationToken);
        var covers = await db.EntityFiles.AsNoTracking()
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

        return rows.Select(row =>
        {
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

    private async Task<Dictionary<Guid, IReadOnlyList<EntityCapability>>> ProjectCapabilitiesAsync(
        IReadOnlyList<Guid> ids,
        CancellationToken cancellationToken)
    {
        var result = ids.ToDictionary(id => id, _ => new List<EntityCapability>());
        var ratings = await db.EntityRatings.AsNoTracking().Where(row => ids.Contains(row.EntityId)).ToArrayAsync(cancellationToken);
        foreach (var row in ratings)
        {
            result[row.EntityId].Add(new RatingCapability(new Rating(row.Value)));
        }

        var flags = await db.EntityFlags.AsNoTracking().Where(row => ids.Contains(row.EntityId)).ToArrayAsync(cancellationToken);
        foreach (var row in flags)
        {
            result[row.EntityId].Add(new FlagsCapability(row.IsFavorite, row.IsNsfw, row.IsOrganized));
        }

        var descriptions = await db.EntityDescriptions.AsNoTracking().Where(row => ids.Contains(row.EntityId)).ToArrayAsync(cancellationToken);
        foreach (var row in descriptions)
        {
            result[row.EntityId].Add(new DescriptionCapability(row.Value));
        }

        var playbacks = await db.EntityPlayback.AsNoTracking().Where(row => ids.Contains(row.EntityId)).ToArrayAsync(cancellationToken);
        foreach (var row in playbacks)
        {
            result[row.EntityId].Add(new PlaybackCapability(row.PlayCount, row.PlayDurationSeconds, row.ResumeSeconds, row.LastPlayedAt, row.CompletedAt));
        }

        var markers = await db.EntityMarkers.AsNoTracking().Where(row => ids.Contains(row.EntityId)).OrderBy(row => row.Seconds).ToArrayAsync(cancellationToken);
        foreach (var group in markers.GroupBy(row => row.EntityId))
        {
            result[group.Key].Add(new MarkersCapability(group.Select(row => new EntityMarker(row.Id, row.Title, row.Seconds, row.EndSeconds)).ToArray()));
        }

        var technical = await db.EntityTechnical.AsNoTracking().Where(row => ids.Contains(row.EntityId)).ToArrayAsync(cancellationToken);
        foreach (var row in technical)
        {
            result[row.EntityId].Add(new TechnicalCapability(ToTimeSpan(row.DurationSeconds), row.Width, row.Height, row.FrameRate, row.BitRate, row.SampleRate, row.Channels, row.Codec, row.Container, row.Format));
        }

        var files = await db.EntityFiles.AsNoTracking().Where(row => ids.Contains(row.EntityId)).ToArrayAsync(cancellationToken);
        foreach (var group in files.GroupBy(row => row.EntityId))
        {
            var imageAssets = group
                .Where(file => file.Role is EntityFileRole.Thumbnail or EntityFileRole.Poster or EntityFileRole.Backdrop or EntityFileRole.Cover)
                .Select(file => new EntityImageAsset(file.Role.ToCode(), file.Path, file.MimeType))
                .ToArray();
            if (imageAssets.Length > 0)
            {
                result[group.Key].Add(new ImagesCapability([], imageAssets, imageAssets.First().Path, imageAssets.First().Path));
            }

            result[group.Key].Add(new FilesCapability(group.Select(file => new Obscura.Contracts.Entities.EntityFile(file.Role.ToCode(), file.Path, file.MimeType)).ToArray()));
        }

        return result.ToDictionary(pair => pair.Key, pair => (IReadOnlyList<EntityCapability>)pair.Value);
    }

    private async Task<IReadOnlyList<EntityGroup>> ProjectChildGroupsAsync(Guid id, CancellationToken cancellationToken)
    {
        var links = await db.EntityChildLinks.AsNoTracking()
            .Where(link => link.ParentEntityId == id)
            .OrderBy(link => link.SortOrder)
            .ToArrayAsync(cancellationToken);
        if (links.Length == 0)
        {
            return [];
        }

        var ids = links.Select(link => link.ChildEntityId).ToArray();
        var rows = await db.Entities.AsNoTracking()
            .Where(entity => ids.Contains(entity.Id) && entity.DeletedAt == null)
            .ToArrayAsync(cancellationToken);
        var thumbnails = await ProjectThumbnailsAsync(rows, cancellationToken);
        return GroupByKind(thumbnails, links.ToDictionary(link => link.ChildEntityId, link => link.SortOrder));
    }

    private async Task<IReadOnlyList<EntityGroup>> ProjectRelationshipGroupsAsync(Guid id, CancellationToken cancellationToken)
    {
        var links = await db.EntityRelationshipLinks.AsNoTracking()
            .Where(link => link.EntityId == id)
            .OrderBy(link => link.SortOrder)
            .ToArrayAsync(cancellationToken);
        if (links.Length == 0)
        {
            return [];
        }

        var ids = links.Select(link => link.TargetEntityId).ToArray();
        var rows = await db.Entities.AsNoTracking()
            .Where(entity => ids.Contains(entity.Id) && entity.DeletedAt == null)
            .ToArrayAsync(cancellationToken);
        var thumbnails = await ProjectThumbnailsAsync(rows, cancellationToken);
        return GroupByKind(thumbnails, links.ToDictionary(link => link.TargetEntityId, link => link.SortOrder));
    }

    private async Task<IReadOnlyList<EntityCreditMetadata>> GetCreditMetadataAsync(Guid id, CancellationToken cancellationToken)
    {
        return await db.EntityRelationshipLinks.AsNoTracking()
            .Where(link => link.EntityId == id && link.TargetKindCode == "person")
            .Select(link => new EntityCreditMetadata(link.TargetEntityId, link.RelationshipCode, null))
            .ToArrayAsync(cancellationToken);
    }

    private static IReadOnlyList<EntityGroup> GroupByKind(
        IReadOnlyList<EntityThumbnail> thumbnails,
        IReadOnlyDictionary<Guid, int> sortOrder)
    {
        return thumbnails
            .OrderBy(item => sortOrder.GetValueOrDefault(item.Id))
            .ThenBy(item => item.Title)
            .GroupBy(item => item.Kind)
            .Select(group => new EntityGroup(group.Key, LabelForKind(group.Key), group.ToArray()))
            .ToArray();
    }

    private static string LabelForKind(string kind) =>
        kind switch
        {
            "video" => "Videos",
            "series" => "Series",
            "season" => "Seasons",
            "image" => "Images",
            "gallery" => "Galleries",
            "book" => "Books",
            "book-page" => "Pages",
            "audio-library" => "Audio Libraries",
            "audio-track" => "Audio Tracks",
            "person" => "People",
            "studio" => "Studios",
            "tag" => "Tags",
            "collection" => "Collections",
            _ => kind
        };

    private static TimeSpan? ToTimeSpan(double? seconds) =>
        seconds is > 0 ? TimeSpan.FromSeconds(seconds.Value) : null;

    private static string EncodeCursor(string title, Guid id) =>
        Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"{title}\n{id:N}"));

    private static bool TryDecodeCursor(string? cursor, out string title, out Guid id)
    {
        title = string.Empty;
        id = Guid.Empty;
        if (string.IsNullOrWhiteSpace(cursor))
        {
            return false;
        }

        try
        {
            var parts = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(cursor)).Split('\n');
            return parts.Length == 2 && Guid.TryParseExact(parts[1], "N", out id) && !string.IsNullOrWhiteSpace(title = parts[0]);
        }
        catch (FormatException)
        {
            return false;
        }
    }
}

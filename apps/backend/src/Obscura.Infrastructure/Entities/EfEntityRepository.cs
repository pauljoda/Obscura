using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Obscura.Application.Entities;
using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using Obscura.Domain.Media;
using Obscura.Domain.Taxonomy;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities;

/// <summary>
/// EF-backed implementation of <see cref="EntityRepository"/> that hydrates domain entities from row storage.
/// </summary>
public sealed class EfEntityRepository(ObscuraDbContext db) : EntityRepository {
    private const string RelatedRelationshipCode = "related";
    private const string CreditsRelationshipCode = "credits";

    /// <inheritdoc />
    public async Task<Entity?> FindAsync(Guid id, CancellationToken cancellationToken) {
        var row = await db.Entities.AsNoTracking()
            .FirstOrDefaultAsync(entity => entity.Id == id && entity.DeletedAt == null, cancellationToken);
        if (row is null) {
            return null;
        }

        var context = new EntityHydrationContext();
        return await HydrateAsync(row, context, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<TEntity?> FindAsync<TEntity>(Guid id, CancellationToken cancellationToken)
        where TEntity : Entity =>
        await FindAsync(id, cancellationToken) is TEntity entity ? entity : null;

    /// <inheritdoc />
    public async Task<TEntity> RequireAsync<TEntity>(Guid id, CancellationToken cancellationToken)
        where TEntity : Entity =>
        await FindAsync<TEntity>(id, cancellationToken)
            ?? throw new InvalidOperationException($"Entity '{id}' was not found as {typeof(TEntity).Name}.");

    /// <inheritdoc />
    public async Task SaveAsync(Entity entity, CancellationToken cancellationToken) {
        ArgumentNullException.ThrowIfNull(entity);
        var visited = new HashSet<Guid>();
        await SaveEntityAsync(entity, visited, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task<Entity> HydrateAsync(
        EntityRow row,
        EntityHydrationContext context,
        CancellationToken cancellationToken) {
        if (context.TryGet(row.Id, out var existing)) {
            return existing;
        }

        var entity = CreateEntity(row);
        context.Add(entity);
        await HydrateChildrenAsync(entity, context, cancellationToken);
        await HydrateRelationshipsAsync(entity, context, cancellationToken);
        await HydrateRatingAsync(entity, cancellationToken);
        await HydrateFlagsAsync(entity, cancellationToken);
        await HydratePlaybackAsync(entity, cancellationToken);
        await HydrateMarkersAsync(entity, cancellationToken);
        return entity;
    }

    private async Task HydrateChildrenAsync(
        Entity entity,
        EntityHydrationContext context,
        CancellationToken cancellationToken) {
        var links = await db.EntityChildLinks.AsNoTracking()
            .Where(link => link.ParentEntityId == entity.Id)
            .OrderBy(link => link.SortOrder)
            .ToArrayAsync(cancellationToken);
        foreach (var link in links) {
            var childRow = await db.Entities.AsNoTracking()
                .FirstOrDefaultAsync(row => row.Id == link.ChildEntityId && row.DeletedAt == null, cancellationToken);
            if (childRow is null) {
                continue;
            }

            var child = await HydrateAsync(childRow, context, cancellationToken);
            if (!entity.ChildEntities.Any(existing => existing.Id == child.Id)) {
                entity.AddChild(child, link.SortOrder);
            }
        }
    }

    private async Task HydrateRelationshipsAsync(
        Entity entity,
        EntityHydrationContext context,
        CancellationToken cancellationToken) {
        var links = await db.EntityRelationshipLinks.AsNoTracking()
            .Where(link => link.EntityId == entity.Id)
            .OrderBy(link => link.RelationshipCode)
            .ThenBy(link => link.SortOrder)
            .ToArrayAsync(cancellationToken);
        foreach (var link in links) {
            var targetRow = await db.Entities.AsNoTracking()
                .FirstOrDefaultAsync(row => row.Id == link.TargetEntityId && row.DeletedAt == null, cancellationToken);
            if (targetRow is null) {
                continue;
            }

            var target = await HydrateAsync(targetRow, context, cancellationToken);
            if (string.Equals(link.RelationshipCode, CreditsRelationshipCode, StringComparison.OrdinalIgnoreCase) &&
                target is Person person) {
                entity.Credits?.Add(person, DecodeCreditRole(link.MetadataJson), string.IsNullOrEmpty(link.Label) ? null : link.Label);
                continue;
            }

            if (!entity.Relationships.Any(existing => existing.Id == target.Id)) {
                entity.AddRelationship(target);
            }
        }
    }

    private async Task HydrateRatingAsync(Entity entity, CancellationToken cancellationToken) {
        var rating = await db.EntityRatings.AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == entity.Id, cancellationToken);
        if (rating is not null && entity.Rating is not null) {
            entity.Rating.Rate(rating.Value);
        }
    }

    private async Task HydrateFlagsAsync(Entity entity, CancellationToken cancellationToken) {
        var row = await db.EntityFlags.AsNoTracking()
            .FirstOrDefaultAsync(flag => flag.EntityId == entity.Id, cancellationToken);
        if (row is null) {
            return;
        }

        var flags = entity.Flags ?? new CapabilityFlags();
        if (entity.Flags is null) {
            entity.AddCapability(flags);
        }

        flags.Patch(row.IsFavorite, row.IsNsfw, row.IsOrganized);
    }

    private async Task HydratePlaybackAsync(Entity entity, CancellationToken cancellationToken) {
        var row = await db.EntityPlayback.AsNoTracking()
            .FirstOrDefaultAsync(playback => playback.EntityId == entity.Id, cancellationToken);
        if (row is null) {
            return;
        }

        entity.RemoveCapability<CapabilityPlayback>();
        entity.AddCapability(new CapabilityPlayback(new Playback(
            row.PlayCount,
            TimeSpan.FromSeconds(row.PlayDurationSeconds),
            TimeSpan.FromSeconds(row.ResumeSeconds),
            row.LastPlayedAt,
            row.CompletedAt)));
    }

    private async Task HydrateMarkersAsync(Entity entity, CancellationToken cancellationToken) {
        var rows = await db.EntityMarkers.AsNoTracking()
            .Where(marker => marker.EntityId == entity.Id)
            .OrderBy(marker => marker.Seconds)
            .ToArrayAsync(cancellationToken);
        if (rows.Length == 0) {
            return;
        }

        entity.RemoveCapability<CapabilityMarkers>();
        entity.AddCapability(new CapabilityMarkers(rows.Select(row => new EntityMarker(row.Id, row.Title, row.Seconds, row.EndSeconds)).ToArray()));
    }

    private async Task SaveEntityAsync(Entity entity, ISet<Guid> visited, CancellationToken cancellationToken) {
        if (!visited.Add(entity.Id)) {
            return;
        }

        await UpsertEntityRowAsync(entity, cancellationToken);

        var childIndex = 0;
        foreach (var child in entity.ChildEntities) {
            await SaveEntityAsync(child, visited, cancellationToken);
            childIndex++;
        }

        var relationshipIndex = 0;
        foreach (var relationship in entity.Relationships) {
            await SaveEntityAsync(relationship, visited, cancellationToken);
            relationshipIndex++;
        }

        foreach (var credit in entity.Credits?.Credits ?? Array.Empty<EntityCredit>()) {
            await SaveEntityAsync(credit.Person, visited, cancellationToken);
        }

        db.EntityChildLinks.RemoveRange(db.EntityChildLinks.Where(link => link.ParentEntityId == entity.Id));
        db.EntityRelationshipLinks.RemoveRange(db.EntityRelationshipLinks.Where(link => link.EntityId == entity.Id));
        await db.SaveChangesAsync(cancellationToken);

        childIndex = 0;
        foreach (var child in entity.ChildEntities) {
            db.EntityChildLinks.Add(new EntityChildLinkRow {
                ParentEntityId = entity.Id,
                ChildEntityId = child.Id,
                ChildKindCode = EntityKindRegistry.ToCode(child.Kind),
                SortOrder = child.SortOrder ?? childIndex,
                IsStructural = true,
                CreatedAt = DateTimeOffset.UtcNow
            });
            childIndex++;
        }

        relationshipIndex = 0;
        foreach (var relationship in entity.Relationships) {
            db.EntityRelationshipLinks.Add(new EntityRelationshipLinkRow {
                EntityId = entity.Id,
                RelationshipCode = RelatedRelationshipCode,
                Label = relationship.Title,
                TargetEntityId = relationship.Id,
                TargetKindCode = EntityKindRegistry.ToCode(relationship.Kind),
                SortOrder = relationshipIndex,
                CreatedAt = DateTimeOffset.UtcNow
            });
            relationshipIndex++;
        }

        var creditIndex = 0;
        foreach (var credit in entity.Credits?.Credits ?? Array.Empty<EntityCredit>()) {
            db.EntityRelationshipLinks.Add(new EntityRelationshipLinkRow {
                EntityId = entity.Id,
                RelationshipCode = CreditsRelationshipCode,
                Label = credit.Label ?? string.Empty,
                TargetEntityId = credit.Person.Id,
                TargetKindCode = EntityKindRegistry.Person.Code,
                SortOrder = creditIndex,
                MetadataJson = JsonSerializer.Serialize(new CreditMetadata(EncodeCreditRole(credit.Role))),
                CreatedAt = DateTimeOffset.UtcNow
            });
            creditIndex++;
        }

        if (entity.Rating?.Value is { } rating) {
            var row = await db.EntityRatings.FindAsync([entity.Id], cancellationToken);
            if (row is null) {
                db.EntityRatings.Add(new EntityRatingRow {
                    EntityId = entity.Id,
                    Value = rating,
                    UpdatedAt = DateTimeOffset.UtcNow
                });
            } else {
                row.Value = rating;
                row.UpdatedAt = DateTimeOffset.UtcNow;
            }
        } else {
            var row = await db.EntityRatings.FindAsync([entity.Id], cancellationToken);
            if (row is not null) {
                db.EntityRatings.Remove(row);
            }
        }

        if (entity.Flags is { } flags) {
            var row = await db.EntityFlags.FindAsync([entity.Id], cancellationToken);
            if (row is null) {
                db.EntityFlags.Add(new EntityFlagRow {
                    EntityId = entity.Id,
                    IsFavorite = flags.IsFavorite ?? false,
                    IsNsfw = flags.IsNsfw ?? false,
                    IsOrganized = flags.IsOrganized ?? false,
                    UpdatedAt = DateTimeOffset.UtcNow
                });
            } else {
                row.IsFavorite = flags.IsFavorite ?? false;
                row.IsNsfw = flags.IsNsfw ?? false;
                row.IsOrganized = flags.IsOrganized ?? false;
                row.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }

        if (entity.PlaybackCapability is { Value: { } playback }) {
            var row = await db.EntityPlayback.FindAsync([entity.Id], cancellationToken);
            if (row is null) {
                db.EntityPlayback.Add(new EntityPlaybackRow {
                    EntityId = entity.Id,
                    PlayCount = playback.PlayCount,
                    PlayDurationSeconds = playback.PlayDuration.TotalSeconds,
                    ResumeSeconds = playback.ResumeTime.TotalSeconds,
                    LastPlayedAt = playback.LastPlayedAt,
                    CompletedAt = playback.CompletedAt,
                    UpdatedAt = DateTimeOffset.UtcNow
                });
            } else {
                row.PlayCount = playback.PlayCount;
                row.PlayDurationSeconds = playback.PlayDuration.TotalSeconds;
                row.ResumeSeconds = playback.ResumeTime.TotalSeconds;
                row.LastPlayedAt = playback.LastPlayedAt;
                row.CompletedAt = playback.CompletedAt;
                row.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }

        if (entity.MarkerCapability is { } markers) {
            var existing = await db.EntityMarkers
                .Where(marker => marker.EntityId == entity.Id)
                .ToArrayAsync(cancellationToken);
            var byId = existing.ToDictionary(marker => marker.Id);
            var markerIds = markers.Items.Select(marker => marker.Id).ToHashSet();
            foreach (var stale in existing.Where(marker => !markerIds.Contains(marker.Id))) {
                db.EntityMarkers.Remove(stale);
            }

            foreach (var marker in markers.Items) {
                if (byId.TryGetValue(marker.Id, out var row)) {
                    row.Title = marker.Title;
                    row.Seconds = marker.Seconds;
                    row.EndSeconds = marker.EndSeconds;
                    row.UpdatedAt = DateTimeOffset.UtcNow;
                    continue;
                }

                db.EntityMarkers.Add(new EntityMarkerRow {
                    Id = marker.Id,
                    EntityId = entity.Id,
                    Title = marker.Title,
                    Seconds = marker.Seconds,
                    EndSeconds = marker.EndSeconds,
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                });
            }
        }
    }

    private async Task UpsertEntityRowAsync(Entity entity, CancellationToken cancellationToken) {
        var row = await db.Entities.FindAsync([entity.Id], cancellationToken);
        var now = DateTimeOffset.UtcNow;
        if (row is null) {
            db.Entities.Add(new EntityRow {
                Id = entity.Id,
                KindCode = EntityKindRegistry.ToCode(entity.Kind),
                Title = entity.Title,
                ParentEntityId = entity.ParentEntityId,
                SortOrder = entity.SortOrder,
                CreatedAt = now,
                UpdatedAt = now
            });
            return;
        }

        row.KindCode = EntityKindRegistry.ToCode(entity.Kind);
        row.Title = entity.Title;
        row.ParentEntityId = entity.ParentEntityId;
        row.SortOrder = entity.SortOrder;
        row.UpdatedAt = now;
    }

    private static Entity CreateEntity(EntityRow row) =>
        EntityKindRegistry.Require(row.KindCode) switch {
            EntityKind.AudioLibrary => new AudioLibrary(row.Id, row.Title),
            EntityKind.AudioTrack => new AudioTrack(row.Id, row.Title, embeddedArtist: null, embeddedAlbum: null),
            EntityKind.Book => new Book(row.Id, row.Title, BookType.Book, coverPageId: null),
            EntityKind.BookVolume => new BookVolume(row.Id, row.Title),
            EntityKind.BookChapter => new BookChapter(row.Id, row.Title, coverPageId: null),
            EntityKind.BookPage => new BookPage(row.Id, row.Title),
            EntityKind.Collection => new Collection(row.Id, row.Title),
            EntityKind.Gallery => new Gallery(row.Id, row.Title, GalleryType.Virtual, coverImageId: null),
            EntityKind.Image => new Image(row.Id, row.Title),
            EntityKind.Person => new Person(row.Id, row.Title),
            EntityKind.Studio => new Studio(row.Id, row.Title),
            EntityKind.Tag => new Tag(row.Id, row.Title),
            EntityKind.Video => new Video(row.Id, row.Title, subtitlesExtractedAt: null),
            EntityKind.VideoSeries => new VideoSeries(row.Id, row.Title),
            EntityKind.VideoSeason => new VideoSeason(row.Id, row.Title, row.ParentEntityId, sortOrder: row.SortOrder),
            _ => throw new InvalidOperationException($"Entity kind '{row.KindCode}' cannot be hydrated.")
        };

    private static CreditRole DecodeCreditRole(string? metadataJson) {
        if (string.IsNullOrWhiteSpace(metadataJson)) {
            return CreditRole.Person;
        }

        try {
            var metadata = JsonSerializer.Deserialize<CreditMetadata>(metadataJson);
            return metadata?.Role?.ToLowerInvariant() switch {
                "actor" => CreditRole.Actor,
                "director" => CreditRole.Director,
                "writer" => CreditRole.Writer,
                "producer" => CreditRole.Producer,
                "creator" => CreditRole.Creator,
                "artist" => CreditRole.Artist,
                "narrator" => CreditRole.Narrator,
                "composer" => CreditRole.Composer,
                _ => CreditRole.Person
            };
        } catch (JsonException) {
            return CreditRole.Person;
        }
    }

    private static string EncodeCreditRole(CreditRole role) =>
        role switch {
            CreditRole.Actor => "actor",
            CreditRole.Director => "director",
            CreditRole.Writer => "writer",
            CreditRole.Producer => "producer",
            CreditRole.Creator => "creator",
            CreditRole.Artist => "artist",
            CreditRole.Narrator => "narrator",
            CreditRole.Composer => "composer",
            _ => "person"
        };

    private sealed record CreditMetadata([property: JsonPropertyName("role")] string Role);

    private sealed class EntityHydrationContext {
        private readonly Dictionary<Guid, Entity> _entities = [];

        public bool TryGet(Guid id, out Entity entity) => _entities.TryGetValue(id, out entity!);

        public void Add(Entity entity) => _entities.Add(entity.Id, entity);
    }
}

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
/// EF-backed repository that hydrates domain entities from row storage and persists their
/// mutable state. Implements the Application <see cref="IEntityWriteRepository"/> port so
/// Application services can mutate entities without taking a direct dependency on EF Core.
/// </summary>
public sealed class EfEntityRepository(ObscuraDbContext db) : IEntityWriteRepository {
    private const string RelatedRelationshipCode = "related";
    private const string CreditsRelationshipCode = "credits";

    /// <summary>
    /// Finds an active entity and hydrates its domain relationships plus mutable state capabilities.
    /// </summary>
    public async Task<Entity?> FindAsync(Guid id, CancellationToken cancellationToken) {
        var row = await db.Entities.AsNoTracking()
            .FirstOrDefaultAsync(entity => entity.Id == id && entity.DeletedAt == null, cancellationToken);
        if (row is null) {
            return null;
        }

        var context = new EntityHydrationContext();
        return await HydrateAsync(row, context, cancellationToken);
    }

    /// <summary>
    /// Finds an active entity and returns it only when it matches the requested concrete domain type.
    /// </summary>
    public async Task<TEntity?> FindAsync<TEntity>(Guid id, CancellationToken cancellationToken)
        where TEntity : Entity =>
        await FindAsync(id, cancellationToken) is TEntity entity ? entity : null;

    /// <summary>
    /// Finds a required active entity of the requested concrete domain type.
    /// </summary>
    public async Task<TEntity> RequireAsync<TEntity>(Guid id, CancellationToken cancellationToken)
        where TEntity : Entity =>
        await FindAsync<TEntity>(id, cancellationToken)
            ?? throw new InvalidOperationException($"Entity '{id}' was not found as {typeof(TEntity).Name}.");

    /// <summary>
    /// Persists one hydrated domain entity slice, including structural links, relationships, and mutable capabilities.
    /// </summary>
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

        var entity = await CreateEntityAsync(row, cancellationToken);
        context.Add(entity);
        await HydrateChildrenAsync(entity, context, cancellationToken);
        await HydrateRelationshipsAsync(entity, context, cancellationToken);
        await HydrateRatingAsync(entity, cancellationToken);
        await HydrateFlagsAsync(entity, cancellationToken);
        await HydratePlaybackAsync(entity, cancellationToken);
        await HydrateMarkersAsync(entity, cancellationToken);
        await HydrateCapabilitiesAsync(entity, cancellationToken);
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
        var childIds = links.Select(link => link.ChildEntityId).ToArray();
        var childRows = await db.Entities.AsNoTracking()
            .Where(row => childIds.Contains(row.Id) && row.DeletedAt == null)
            .ToDictionaryAsync(row => row.Id, cancellationToken);
        foreach (var link in links) {
            if (!childRows.TryGetValue(link.ChildEntityId, out var childRow)) {
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
        var targetIds = links.Select(link => link.TargetEntityId).ToArray();
        var targetRows = await db.Entities.AsNoTracking()
            .Where(row => targetIds.Contains(row.Id) && row.DeletedAt == null)
            .ToDictionaryAsync(row => row.Id, cancellationToken);
        foreach (var link in links) {
            if (!targetRows.TryGetValue(link.TargetEntityId, out var targetRow)) {
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
        entity.AddCapability(new CapabilityPlayback(new CapabilityPlayback.State(
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
        entity.AddCapability(new CapabilityMarkers(rows.Select(row => new CapabilityMarkers.Item(row.Id, row.Title, row.Seconds, row.EndSeconds)).ToArray()));
    }

    private async Task HydrateCapabilitiesAsync(Entity entity, CancellationToken cancellationToken) {
        var id = entity.Id;

        var description = await db.EntityDescriptions.AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);
        if (description is not null) {
            Replace(entity, new CapabilityDescription(description.Value));
        }

        var technical = await db.EntityTechnical.AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);
        if (technical is not null) {
            var technicalCapability = new CapabilityTechnical();
            technicalCapability.Apply(
                technical.DurationSeconds is { } seconds ? TimeSpan.FromSeconds(seconds) : null,
                technical.Width,
                technical.Height,
                technical.FrameRate,
                technical.BitRate,
                technical.SampleRate,
                technical.Channels,
                technical.Codec,
                technical.Container,
                technical.Format);
            Replace(entity, technicalCapability);
        }

        var classification = await db.EntityClassifications.AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);
        if (classification is not null) {
            Replace(entity, new CapabilityClassification(classification.Value, classification.System));
        }

        var progress = await db.EntityProgress.AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);
        if (progress is not null) {
            Replace(entity, new CapabilityProgress(
                progress.CurrentEntityId,
                progress.Unit,
                progress.Index,
                progress.Total,
                progress.Mode,
                progress.CompletedAt,
                progress.UpdatedAt));
        }

        var urls = await db.EntityUrls.AsNoTracking()
            .Where(row => row.EntityId == id).OrderBy(row => row.SortOrder).ToArrayAsync(cancellationToken);
        var externalIds = await db.EntityExternalIds.AsNoTracking()
            .Where(row => row.EntityId == id).ToArrayAsync(cancellationToken);
        if (urls.Length > 0 || externalIds.Length > 0) {
            Replace(entity, new CapabilityLinks(
                urls.Select(row => new CapabilityLinks.Url(row.Url, row.Label)).ToArray(),
                externalIds.Select(row => new CapabilityLinks.ExternalId(row.Provider, row.Value, row.Url)).ToArray()));
        }

        var files = await db.EntityFiles.AsNoTracking()
            .Where(row => row.EntityId == id).OrderBy(row => row.CreatedAt).ToArrayAsync(cancellationToken);
        if (files.Length > 0) {
            Replace(entity, new CapabilityFiles(
                files.Select(row => new CapabilityFiles.Item(row.Role, row.Path, row.MimeType)).ToArray()));
        }

        var subtitles = await db.EntitySubtitles.AsNoTracking()
            .Where(row => row.EntityId == id).OrderBy(row => row.CreatedAt).ToArrayAsync(cancellationToken);
        if (subtitles.Length > 0) {
            Replace(entity, new CapabilitySubtitles(subtitles.Select(row => new CapabilitySubtitles.Item(
                row.Id, row.Language, row.Label, row.Format, row.Source,
                row.StoragePath, row.SourceFormat, row.SourcePath, row.IsDefault)).ToArray()));
        }

        var fingerprints = await db.EntityFileFingerprints.AsNoTracking()
            .Where(row => row.EntityId == id).OrderBy(row => row.CreatedAt).ToArrayAsync(cancellationToken);
        if (fingerprints.Length > 0) {
            Replace(entity, new CapabilityFingerprints(
                fingerprints.Select(row => new CapabilityFingerprints.Item(row.Algorithm, row.Value)).ToArray()));
        }

        var stats = await db.EntityStats.AsNoTracking()
            .Where(row => row.EntityId == id).OrderBy(row => row.Code).ToArrayAsync(cancellationToken);
        if (stats.Length > 0) {
            Replace(entity, new CapabilityStats(stats.Select(row => new CapabilityStats.Item(row.Code, row.Value)).ToArray()));
        }

        var dates = await db.EntityDates.AsNoTracking()
            .Where(row => row.EntityId == id).OrderBy(row => row.Code).ToArrayAsync(cancellationToken);
        if (dates.Length > 0) {
            Replace(entity, new CapabilityDates(dates.Select(row =>
                new EntityDate(row.Code, row.Value, row.SortableValue, row.Precision)).ToArray()));
        }

        var sources = await db.EntitySources.AsNoTracking()
            .Where(row => row.EntityId == id).OrderBy(row => row.Code).ToArrayAsync(cancellationToken);
        if (sources.Length > 0) {
            Replace(entity, new CapabilitySource(sources.Select(row => new CapabilitySource.Item(row.Code, row.Value)).ToArray()));
        }

        var positions = await db.EntityPositions.AsNoTracking()
            .Where(row => row.EntityId == id).OrderBy(row => row.Code).ToArrayAsync(cancellationToken);
        if (positions.Length > 0) {
            Replace(entity, new CapabilityPosition(positions.Select(row =>
                new CapabilityPosition.Item(row.Code, row.Value, row.Label)).ToArray()));
        }
    }

    private static void Replace<TCapability>(Entity entity, TCapability capability)
        where TCapability : EntityCapability {
        entity.RemoveCapability<TCapability>();
        entity.AddCapability(capability);
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

        foreach (var credit in entity.Credits?.Credits ?? Array.Empty<CapabilityCredits.Item>()) {
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
        foreach (var credit in entity.Credits?.Credits ?? Array.Empty<CapabilityCredits.Item>()) {
            db.EntityRelationshipLinks.Add(new EntityRelationshipLinkRow {
                EntityId = entity.Id,
                RelationshipCode = CreditsRelationshipCode,
                Label = credit.Label ?? string.Empty,
                TargetEntityId = credit.Person.Id,
                TargetKindCode = EntityKindRegistry.Person.Code,
                SortOrder = creditIndex,
                MetadataJson = JsonSerializer.Serialize(new CreditMetadata(credit.Role.ToCode())),
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

        await SaveCapabilitiesAsync(entity, cancellationToken);
        await SaveDetailAsync(entity, cancellationToken);
    }

    private async Task SaveDetailAsync(Entity entity, CancellationToken cancellationToken) {
        var id = entity.Id;
        switch (entity) {
            case Video video: {
                var row = await db.VideoDetails.FindAsync([id], cancellationToken)
                    ?? Track(db.VideoDetails, new VideoDetailRow { EntityId = id });
                row.SubtitlesExtractedAt = video.SubtitlesExtractedAt;
                break;
            }
            case VideoSeries series: {
                var row = await db.VideoSeriesDetails.FindAsync([id], cancellationToken)
                    ?? Track(db.VideoSeriesDetails, new VideoSeriesDetailRow { EntityId = id });
                row.Status = series.Status;
                break;
            }
            case Gallery gallery: {
                var row = await db.GalleryDetails.FindAsync([id], cancellationToken)
                    ?? Track(db.GalleryDetails, new GalleryDetailRow { EntityId = id });
                row.GalleryType = gallery.GalleryType;
                row.CoverImageEntityId = gallery.CoverImageId;
                break;
            }
            case Book book: {
                var row = await db.BookDetails.FindAsync([id], cancellationToken)
                    ?? Track(db.BookDetails, new BookDetailRow { EntityId = id });
                row.BookType = book.BookType;
                row.CoverPageEntityId = book.CoverPageId;
                break;
            }
            case BookChapter chapter: {
                var row = await db.BookChapterDetails.FindAsync([id], cancellationToken)
                    ?? Track(db.BookChapterDetails, new BookChapterDetailRow { EntityId = id });
                row.CoverPageEntityId = chapter.CoverPageId;
                break;
            }
            case AudioTrack track: {
                var row = await db.AudioTrackDetails.FindAsync([id], cancellationToken)
                    ?? Track(db.AudioTrackDetails, new AudioTrackDetailRow { EntityId = id });
                row.EmbeddedArtist = track.EmbeddedArtist;
                row.EmbeddedAlbum = track.EmbeddedAlbum;
                break;
            }
            case Person person: {
                var row = await db.PersonDetails.FindAsync([id], cancellationToken)
                    ?? Track(db.PersonDetails, new PersonDetailRow { EntityId = id });
                row.Disambiguation = person.Disambiguation;
                row.Gender = person.Gender;
                row.Country = person.Country;
                row.Ethnicity = person.Ethnicity;
                row.EyeColor = person.EyeColor;
                row.HairColor = person.HairColor;
                row.Height = person.Height;
                row.Weight = person.Weight;
                row.Measurements = person.Measurements;
                row.Tattoos = person.Tattoos;
                row.Piercings = person.Piercings;
                break;
            }
            case Tag tag: {
                var row = await db.TagDetails.FindAsync([id], cancellationToken)
                    ?? Track(db.TagDetails, new TagDetailRow { EntityId = id });
                row.IgnoreAutoTag = tag.IgnoreAutoTag;
                break;
            }
            case Collection collection: {
                var row = await db.CollectionDetails.FindAsync([id], cancellationToken)
                    ?? Track(db.CollectionDetails, new CollectionDetailRow { EntityId = id });
                row.Mode = collection.Mode;
                row.RuleTreeJson = collection.RuleTreeJson;
                row.CoverMode = collection.CoverMode;
                row.CoverItemEntityId = collection.CoverItemId;
                row.SlideshowDurationSeconds = (int)collection.SlideshowDuration.TotalSeconds;
                row.SlideshowAutoAdvance = collection.SlideshowAutoAdvance;
                row.LastRefreshedAt = collection.LastRefreshedAt;
                break;
            }
        }
    }

    private static TRow Track<TRow>(DbSet<TRow> set, TRow row)
        where TRow : class {
        set.Add(row);
        return row;
    }

    private async Task SaveCapabilitiesAsync(Entity entity, CancellationToken cancellationToken) {
        var id = entity.Id;
        db.EntityDescriptions.RemoveRange(db.EntityDescriptions.Where(r => r.EntityId == id));
        db.EntityTechnical.RemoveRange(db.EntityTechnical.Where(r => r.EntityId == id));
        db.EntityClassifications.RemoveRange(db.EntityClassifications.Where(r => r.EntityId == id));
        db.EntityProgress.RemoveRange(db.EntityProgress.Where(r => r.EntityId == id));
        db.EntityUrls.RemoveRange(db.EntityUrls.Where(r => r.EntityId == id));
        db.EntityExternalIds.RemoveRange(db.EntityExternalIds.Where(r => r.EntityId == id));
        db.EntityFiles.RemoveRange(db.EntityFiles.Where(r => r.EntityId == id));
        db.EntitySubtitles.RemoveRange(db.EntitySubtitles.Where(r => r.EntityId == id));
        db.EntityFileFingerprints.RemoveRange(db.EntityFileFingerprints.Where(r => r.EntityId == id));
        db.EntityStats.RemoveRange(db.EntityStats.Where(r => r.EntityId == id));
        db.EntityDates.RemoveRange(db.EntityDates.Where(r => r.EntityId == id));
        db.EntitySources.RemoveRange(db.EntitySources.Where(r => r.EntityId == id));
        db.EntityPositions.RemoveRange(db.EntityPositions.Where(r => r.EntityId == id));
        await db.SaveChangesAsync(cancellationToken);

        var now = DateTimeOffset.UtcNow;

        if (entity.Description is { } description && !string.IsNullOrEmpty(description.Value)) {
            db.EntityDescriptions.Add(new EntityDescriptionRow { EntityId = id, Value = description.Value, UpdatedAt = now });
        }

        if (entity.Technical is { } technical && HasTechnicalData(technical)) {
            db.EntityTechnical.Add(new EntityTechnicalRow {
                EntityId = id,
                DurationSeconds = technical.Duration?.TotalSeconds,
                Width = technical.Width,
                Height = technical.Height,
                FrameRate = technical.FrameRate,
                BitRate = technical.BitRate,
                SampleRate = technical.SampleRate,
                Channels = technical.Channels,
                Codec = technical.Codec,
                Container = technical.Container,
                Format = technical.Format,
                UpdatedAt = now
            });
        }

        if (entity.Classification is { } classification && (classification.Value is not null || classification.System is not null)) {
            db.EntityClassifications.Add(new EntityClassificationRow {
                EntityId = id, Value = classification.Value, System = classification.System, UpdatedAt = now
            });
        }

        if (entity.Progress is { } progress &&
            (progress.UpdatedAt is not null || progress.CurrentEntityId is not null || progress.Index != 0 || progress.Total != 0)) {
            db.EntityProgress.Add(new EntityProgressRow {
                EntityId = id,
                CurrentEntityId = progress.CurrentEntityId,
                Unit = progress.Unit,
                Index = progress.Index,
                Total = progress.Total,
                Mode = progress.Mode,
                CompletedAt = progress.CompletedAt,
                UpdatedAt = progress.UpdatedAt ?? now
            });
        }

        if (entity.GetCapability<CapabilityLinks>() is { } links) {
            var order = 0;
            foreach (var url in links.Urls) {
                db.EntityUrls.Add(new EntityUrlRow {
                    Id = Guid.NewGuid(), EntityId = id, Url = url.Value, Label = url.Label, SortOrder = order++, CreatedAt = now
                });
            }

            foreach (var externalId in links.ExternalIds) {
                db.EntityExternalIds.Add(new EntityExternalIdRow {
                    Id = Guid.NewGuid(), EntityId = id, Provider = externalId.Provider,
                    Value = externalId.Value, Url = externalId.Url, CreatedAt = now, UpdatedAt = now
                });
            }
        }

        foreach (var file in entity.Files?.Items ?? []) {
            db.EntityFiles.Add(new EntityFileRow {
                Id = Guid.NewGuid(), EntityId = id, Role = file.Role, Path = file.Path,
                MimeType = file.MimeType, CreatedAt = now, UpdatedAt = now
            });
        }

        foreach (var subtitle in entity.SubtitleCapability?.Items ?? []) {
            db.EntitySubtitles.Add(new EntitySubtitleRow {
                Id = subtitle.Id == Guid.Empty ? Guid.NewGuid() : subtitle.Id,
                EntityId = id, Language = subtitle.Language, Label = subtitle.Label, Format = subtitle.Format,
                Source = subtitle.Source, StoragePath = subtitle.StoragePath, SourceFormat = subtitle.SourceFormat,
                SourcePath = subtitle.SourcePath, IsDefault = subtitle.IsDefault, CreatedAt = now
            });
        }

        foreach (var fingerprint in entity.GetCapability<CapabilityFingerprints>()?.Items ?? []) {
            db.EntityFileFingerprints.Add(new EntityFileFingerprintRow {
                Id = Guid.NewGuid(), EntityId = id, Algorithm = fingerprint.Algorithm, Value = fingerprint.Value, CreatedAt = now
            });
        }

        foreach (var stat in entity.Stats?.Items ?? []) {
            db.EntityStats.Add(new EntityStatRow { EntityId = id, Code = stat.Code, Value = stat.Value, UpdatedAt = now });
        }

        foreach (var date in entity.Dates?.Items ?? []) {
            db.EntityDates.Add(new EntityDateRow {
                EntityId = id, Code = date.Code, Value = date.Value,
                SortableValue = date.SortableValue, Precision = date.Precision, UpdatedAt = now
            });
        }

        foreach (var source in entity.Source?.Items ?? []) {
            db.EntitySources.Add(new EntitySourceRow { EntityId = id, Code = source.Code, Value = source.Value, UpdatedAt = now });
        }

        foreach (var position in entity.Position?.Items ?? []) {
            db.EntityPositions.Add(new EntityPositionRow {
                EntityId = id, Code = position.Code, Value = position.Value, Label = position.Label, UpdatedAt = now
            });
        }
    }

    private static bool HasTechnicalData(CapabilityTechnical technical) =>
        technical.Duration is not null || technical.Width is not null || technical.Height is not null ||
        technical.FrameRate is not null || technical.BitRate is not null || technical.SampleRate is not null ||
        technical.Channels is not null || technical.Codec is not null || technical.Container is not null ||
        technical.Format is not null;

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

    private async Task<Entity> CreateEntityAsync(EntityRow row, CancellationToken cancellationToken) {
        var id = row.Id;
        switch (EntityKindRegistry.Require(row.KindCode)) {
            case EntityKind.AudioLibrary:
                return new AudioLibrary(id, row.Title);
            case EntityKind.AudioTrack: {
                var detail = await db.AudioTrackDetails.AsNoTracking().FirstOrDefaultAsync(d => d.EntityId == id, cancellationToken);
                return new AudioTrack(id, row.Title, detail?.EmbeddedArtist, detail?.EmbeddedAlbum);
            }
            case EntityKind.Book: {
                var detail = await db.BookDetails.AsNoTracking().FirstOrDefaultAsync(d => d.EntityId == id, cancellationToken);
                return new Book(id, row.Title, detail?.BookType ?? BookType.Book, detail?.CoverPageEntityId);
            }
            case EntityKind.BookVolume:
                return new BookVolume(id, row.Title);
            case EntityKind.BookChapter: {
                var detail = await db.BookChapterDetails.AsNoTracking().FirstOrDefaultAsync(d => d.EntityId == id, cancellationToken);
                return new BookChapter(id, row.Title, detail?.CoverPageEntityId);
            }
            case EntityKind.BookPage:
                return new BookPage(id, row.Title);
            case EntityKind.Collection: {
                var detail = await db.CollectionDetails.AsNoTracking().FirstOrDefaultAsync(d => d.EntityId == id, cancellationToken);
                return detail is null
                    ? new Collection(id, row.Title)
                    : new Collection(
                        id,
                        row.Title,
                        detail.Mode,
                        detail.RuleTreeJson,
                        detail.CoverMode,
                        detail.CoverItemEntityId,
                        TimeSpan.FromSeconds(detail.SlideshowDurationSeconds),
                        detail.SlideshowAutoAdvance,
                        detail.LastRefreshedAt);
            }
            case EntityKind.Gallery: {
                var detail = await db.GalleryDetails.AsNoTracking().FirstOrDefaultAsync(d => d.EntityId == id, cancellationToken);
                return new Gallery(id, row.Title, detail?.GalleryType ?? GalleryType.Virtual, detail?.CoverImageEntityId);
            }
            case EntityKind.Image:
                return new Image(id, row.Title);
            case EntityKind.Person: {
                var detail = await db.PersonDetails.AsNoTracking().FirstOrDefaultAsync(d => d.EntityId == id, cancellationToken);
                return new Person(
                    id,
                    row.Title,
                    detail?.Disambiguation,
                    detail?.Gender,
                    detail?.Country,
                    detail?.Ethnicity,
                    detail?.EyeColor,
                    detail?.HairColor,
                    detail?.Height,
                    detail?.Weight,
                    detail?.Measurements,
                    detail?.Tattoos,
                    detail?.Piercings);
            }
            case EntityKind.Studio:
                return new Studio(id, row.Title);
            case EntityKind.Tag: {
                var detail = await db.TagDetails.AsNoTracking().FirstOrDefaultAsync(d => d.EntityId == id, cancellationToken);
                return new Tag(id, row.Title, detail?.IgnoreAutoTag ?? false);
            }
            case EntityKind.Video: {
                var detail = await db.VideoDetails.AsNoTracking().FirstOrDefaultAsync(d => d.EntityId == id, cancellationToken);
                return new Video(id, row.Title, detail?.SubtitlesExtractedAt);
            }
            case EntityKind.VideoSeries: {
                var detail = await db.VideoSeriesDetails.AsNoTracking().FirstOrDefaultAsync(d => d.EntityId == id, cancellationToken);
                return new VideoSeries(id, row.Title, detail?.Status);
            }
            case EntityKind.VideoSeason:
                return new VideoSeason(id, row.Title, row.ParentEntityId, sortOrder: row.SortOrder);
            default:
                throw new InvalidOperationException($"Entity kind '{row.KindCode}' cannot be hydrated.");
        }
    }

    private static CreditRole DecodeCreditRole(string? metadataJson) {
        if (string.IsNullOrWhiteSpace(metadataJson)) {
            return CreditRole.Person;
        }

        try {
            var metadata = JsonSerializer.Deserialize<CreditMetadata>(metadataJson);
            return metadata?.Role is { } role && role.TryDecodeAs<CreditRole>(out var decoded)
                ? decoded
                : CreditRole.Person;
        } catch (JsonException) {
            return CreditRole.Person;
        }
    }

    private sealed record CreditMetadata([property: JsonPropertyName("role")] string Role);

    private sealed class EntityHydrationContext {
        private readonly Dictionary<Guid, Entity> _entities = [];

        public bool TryGet(Guid id, out Entity entity) => _entities.TryGetValue(id, out entity!);

        public void Add(Entity entity) => _entities.Add(entity.Id, entity);
    }
}

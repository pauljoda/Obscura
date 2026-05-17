using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;
using Obscura.Domain.Media;
using Obscura.Domain.Taxonomy;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities;

/// <summary>
/// Builds explicit domain capability lists from v2 entity and capability table rows.
/// </summary>
public sealed partial class EntityProjectionService
{
    private async Task<IReadOnlyList<Entity>> BuildEntitiesAsync(
        IReadOnlyList<EntityRow> rows,
        CancellationToken cancellationToken,
        bool includeChildren = false)
    {
        if (rows.Count == 0)
        {
            return [];
        }

        var ids = rows.Select(row => row.Id).ToArray();
        var descriptions = await _db.EntityDescriptions
            .AsNoTracking()
            .Where(row => ids.Contains(row.EntityId))
            .ToDictionaryAsync(row => row.EntityId, row => row.Value, cancellationToken);
        var ratings = await _db.EntityRatings
            .AsNoTracking()
            .Where(row => ids.Contains(row.EntityId))
            .ToDictionaryAsync(row => row.EntityId, row => row.Value, cancellationToken);
        var flags = await _db.EntityFlags
            .AsNoTracking()
            .Where(row => ids.Contains(row.EntityId))
            .ToDictionaryAsync(row => row.EntityId, cancellationToken);
        var files = await LoadFilesAsync(ids, cancellationToken);
        var fingerprints = await LoadFingerprintsAsync(ids, cancellationToken);
        var playback = await LoadPlaybackAsync(ids, cancellationToken);
        var counters = await LoadCountersAsync(ids, cancellationToken);
        var stats = await LoadStatsAsync(ids, cancellationToken);
        var dates = await LoadDatesAsync(ids, cancellationToken);
        var technical = await LoadTechnicalAsync(ids, cancellationToken);
        var sources = await LoadSourcesAsync(ids, cancellationToken);
        var progress = await LoadProgressAsync(ids, cancellationToken);
        var positions = await LoadPositionsAsync(ids, cancellationToken);
        var classifications = await LoadClassificationsAsync(ids, cancellationToken);
        var markers = await LoadMarkersAsync(ids, cancellationToken);
        var subtitles = await LoadSubtitlesAsync(ids, cancellationToken);
        var relationships = await LoadRelationshipsAsync(ids, cancellationToken);
        var urls = await LoadUrlsAsync(ids, cancellationToken);
        var externalIds = await LoadExternalIdsAsync(ids, cancellationToken);
        var childrenByParent = includeChildren
            ? await LoadChildrenByParentAsync(ids, cancellationToken)
            : new Dictionary<Guid, EntityChildren>();

        return rows
            .Select(row =>
            {
                var kind = ResolveKind(row.KindCode);
                descriptions.TryGetValue(row.Id, out var description);
                ratings.TryGetValue(row.Id, out var rating);
                flags.TryGetValue(row.Id, out var flag);
                files.TryGetValue(row.Id, out var fileRefs);
                fingerprints.TryGetValue(row.Id, out var fingerprintRefs);
                playback.TryGetValue(row.Id, out var playbackState);
                counters.TryGetValue(row.Id, out var counterRefs);
                stats.TryGetValue(row.Id, out var statRefs);
                dates.TryGetValue(row.Id, out var dateRefs);
                technical.TryGetValue(row.Id, out var technicalState);
                sources.TryGetValue(row.Id, out var sourceRefs);
                progress.TryGetValue(row.Id, out var progressState);
                positions.TryGetValue(row.Id, out var positionRefs);
                classifications.TryGetValue(row.Id, out var classification);
                markers.TryGetValue(row.Id, out var markerRefs);
                subtitles.TryGetValue(row.Id, out var subtitleRefs);
                relationships.TryGetValue(row.Id, out var relationshipGroups);
                urls.TryGetValue(row.Id, out var urlRefs);
                externalIds.TryGetValue(row.Id, out var externalIdRefs);
                childrenByParent.TryGetValue(row.Id, out var childrenByKind);

                var entity = new Entity(
                    row.Id,
                    kind,
                    row.Title,
                    BuildExplicitCapabilities(
                        kind,
                        description,
                        ratings.ContainsKey(row.Id) ? Rating.FromNullable(rating) : null,
                        fileRefs ?? [],
                        fingerprintRefs ?? [],
                        playbackState,
                        counterRefs ?? [],
                        statRefs ?? [],
                        dateRefs ?? [],
                        technicalState,
                        sourceRefs ?? [],
                        progressState,
                        positionRefs ?? [],
                        classification,
                        markerRefs ?? [],
                        subtitleRefs ?? [],
                        urlRefs ?? [],
                        externalIdRefs ?? [],
                        flag),
                    row.ParentEntityId,
                    row.SortOrder,
                    childrenByKind,
                    relationshipGroups);
                return MaterializeKnownEntity(entity);
            })
            .ToArray();
    }

    private static Entity MaterializeKnownEntity(Entity entity) =>
        entity.Kind.Code switch
        {
            "video" => new Video(entity, null),
            "video-season" => new VideoSeason(entity, entity.ParentEntityId),
            "image" => new Image(entity),
            _ => entity
        };

    private async Task<IReadOnlyDictionary<Guid, EntityChildren>> LoadChildrenByParentAsync(
        IReadOnlyList<Guid> parentIds,
        CancellationToken cancellationToken)
    {
        var links = await _db.EntityChildLinks
            .AsNoTracking()
            .Where(link => parentIds.Contains(link.ParentEntityId))
            .ToListAsync(cancellationToken);
        if (links.Count == 0)
        {
            return new Dictionary<Guid, EntityChildren>();
        }

        var childIds = links.Select(link => link.ChildEntityId).Distinct().ToArray();
        var childRows = await _db.Entities
            .AsNoTracking()
            .Where(entity => childIds.Contains(entity.Id) && entity.DeletedAt == null)
            .ToListAsync(cancellationToken);
        var childRowsById = childRows.ToDictionary(entity => entity.Id);
        var childrenById = (await BuildEntitiesAsync(childRows, cancellationToken))
            .ToDictionary(entity => entity.Id);

        return links
            .Where(link => childrenById.ContainsKey(link.ChildEntityId))
            .OrderBy(link => link.ParentEntityId)
            .ThenBy(link => link.ChildKindCode)
            .ThenBy(link => link.SortOrder)
            .ThenBy(link => childRowsById[link.ChildEntityId].CreatedAt)
            .ThenBy(link => link.ChildEntityId)
            .GroupBy(link => link.ParentEntityId)
            .ToDictionary(
                group => group.Key,
                group => new EntityChildren(group
                    .GroupBy(link => link.ChildKindCode, StringComparer.OrdinalIgnoreCase)
                    .Select(kindGroup =>
                    {
                        var orderedChildren = kindGroup
                            .Where(link => childrenById.ContainsKey(link.ChildEntityId))
                            .Select(link => childrenById[link.ChildEntityId])
                            .ToArray();
                        return new EntityChildSet(orderedChildren.First().Kind, orderedChildren);
                    })
                    .Where(set => set.Items.Count > 0)
                    .ToArray()));
    }

    private static IReadOnlyList<ICapability> BuildExplicitCapabilities(
        IEntityKind kind,
        string? description,
        Rating? rating,
        IReadOnlyList<EntityFile> files,
        IReadOnlyList<EntityFingerprint> fingerprints,
        Playback? playback,
        IReadOnlyList<EntityCounter> counters,
        IReadOnlyList<EntityStat> stats,
        IReadOnlyList<EntityDate> dates,
        CapabilityTechnical? technical,
        IReadOnlyList<EntitySource> sources,
        CapabilityProgress? progress,
        IReadOnlyList<EntityPosition> positions,
        CapabilityClassification? classification,
        IReadOnlyList<EntityMarker> markers,
        IReadOnlyList<EntitySubtitle> subtitles,
        IReadOnlyList<EntityUrl> urls,
        IReadOnlyList<EntityExternalId> externalIds,
        EntityFlagRow? flag)
    {
        var imageAssets = files
            .Where(file => kind.ImageAssetRoles.Contains(file.Role))
            .Select(file => new EntityImageAsset(file.Role, file.Path, file.MimeType))
            .ToArray();
        var thumbnailUrl = imageAssets.FirstOrDefault(asset => asset.Kind == EntityFileRole.Thumbnail)?.Path ??
            imageAssets.FirstOrDefault(asset => asset.Kind == EntityFileRole.Cover)?.Path ??
            imageAssets.FirstOrDefault(asset => asset.Kind == EntityFileRole.Poster)?.Path ??
            imageAssets.FirstOrDefault(asset => asset.Kind == EntityFileRole.Source)?.Path;
        var coverUrl = imageAssets.FirstOrDefault(asset => asset.Kind == EntityFileRole.Cover)?.Path ??
            imageAssets.FirstOrDefault(asset => asset.Kind == EntityFileRole.Poster)?.Path ??
            imageAssets.FirstOrDefault(asset => asset.Kind == EntityFileRole.Thumbnail)?.Path;

        var capabilities = new List<ICapability>();
        AddIfSupported(capabilities, kind, new CapabilityRating(rating));

        // Only emit the images capability when there are actual image assets or a
        // resolved thumbnail/cover URL. Emitting an empty images capability with
        // null URLs is harmless but can mislead the frontend into thinking images
        // "could" exist, leading to wasted placeholder rendering.
        if (imageAssets.Length > 0 || thumbnailUrl is not null || coverUrl is not null)
        {
            AddIfSupported(capabilities, kind, new CapabilityImages(kind.ImageAssetRoles, imageAssets, thumbnailUrl, coverUrl));
        }
        AddIfSupported(capabilities, kind, new CapabilityLinks(urls, externalIds));
        AddIfSupported(capabilities, kind, new CapabilityFlags(flag?.IsFavorite, flag?.IsNsfw, flag?.IsOrganized));
        AddIfSupported(capabilities, kind, new CapabilityFiles(files));

        if (!string.IsNullOrWhiteSpace(description))
        {
            AddIfSupported(capabilities, kind, new CapabilityDescription(description));
        }

        if (fingerprints.Count > 0)
        {
            AddIfSupported(capabilities, kind, new CapabilityFingerprints(fingerprints));
        }

        if (playback is not null)
        {
            AddIfSupported(capabilities, kind, new CapabilityPlayback(playback));
        }

        if (counters.Count > 0)
        {
            AddIfSupported(capabilities, kind, new CapabilityCounters(counters));
        }

        if (stats.Count > 0)
        {
            AddIfSupported(capabilities, kind, new CapabilityStats(stats));
        }

        if (dates.Count > 0)
        {
            AddIfSupported(capabilities, kind, new CapabilityDates(dates));
            var lifetime = BuildLifetime(kind, dates);
            if (lifetime is not null)
            {
                AddIfSupported(capabilities, kind, lifetime);
            }
        }

        if (technical is not null)
        {
            AddIfSupported(capabilities, kind, technical);
        }

        if (sources.Count > 0)
        {
            AddIfSupported(capabilities, kind, new CapabilitySource(sources));
        }

        if (progress is not null)
        {
            AddIfSupported(capabilities, kind, progress);
        }

        if (positions.Count > 0)
        {
            AddIfSupported(capabilities, kind, new CapabilityPosition(positions));
        }

        if (classification is not null)
        {
            AddIfSupported(capabilities, kind, classification);
        }

        if (markers.Count > 0)
        {
            AddIfSupported(capabilities, kind, new CapabilityMarkers(markers));
        }

        if (subtitles.Count > 0)
        {
            AddIfSupported(capabilities, kind, new CapabilitySubtitles(subtitles));
        }

        return capabilities;
    }

    private static void AddIfSupported(List<ICapability> capabilities, IEntityKind kind, ICapability capability)
    {
        if (kind.SupportedCapabilities.Any(supported => ReferenceEquals(supported, capability.Kind)))
        {
            capabilities.Add(capability);
        }
    }

    private static CapabilityLifetime? BuildLifetime(IEntityKind kind, IReadOnlyList<EntityDate> dates)
    {
        EntityDate? start = null;
        EntityDate? end = null;
        string? label = null;

        if (string.Equals(kind.Code, EntityKindRegistry.Person.Code, StringComparison.OrdinalIgnoreCase))
        {
            start = FindDate(dates, "birth", "birthdate", "date-of-birth", "dob");
            end = FindDate(dates, "death", "deathdate", "date-of-death", "dod");
            label = "Life";
        }
        else if (string.Equals(kind.Code, EntityKindRegistry.VideoSeries.Code, StringComparison.OrdinalIgnoreCase))
        {
            start = FindDate(dates, "first-air", "first_air", "first-air-date", "release");
            end = FindDate(dates, "end-air", "last-air", "last_air", "end-air-date");
            label = "Aired";
        }
        else if (string.Equals(kind.Code, EntityKindRegistry.Studio.Code, StringComparison.OrdinalIgnoreCase))
        {
            start = FindDate(dates, "founded", "founded-at", "opened");
            end = FindDate(dates, "closed", "closed-at");
            label = "Active";
        }

        return start is null && end is null ? null : new CapabilityLifetime(start, end, label);
    }

    private static EntityDate? FindDate(IReadOnlyList<EntityDate> dates, params string[] codes) =>
        dates.FirstOrDefault(date => codes.Contains(date.Code, StringComparer.OrdinalIgnoreCase));
}

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
        CancellationToken cancellationToken)
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
        var tags = await LoadTagReferencesAsync(ids, cancellationToken);
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
        var studios = await LoadStudioReferencesAsync(ids, cancellationToken);
        var credits = await LoadCreditReferencesAsync(ids, cancellationToken);
        var urls = await LoadUrlsAsync(ids, cancellationToken);
        var externalIds = await LoadExternalIdsAsync(ids, cancellationToken);

        return rows
            .Select(row =>
            {
                var kind = ResolveKind(row.KindCode);
                descriptions.TryGetValue(row.Id, out var description);
                ratings.TryGetValue(row.Id, out var rating);
                flags.TryGetValue(row.Id, out var flag);
                tags.TryGetValue(row.Id, out var tagRefs);
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
                studios.TryGetValue(row.Id, out var studio);
                credits.TryGetValue(row.Id, out var creditRefs);
                urls.TryGetValue(row.Id, out var urlRefs);
                externalIds.TryGetValue(row.Id, out var externalIdRefs);

                return new Entity(
                    row.Id,
                    kind,
                    row.Title,
                    BuildExplicitCapabilities(
                        kind,
                        description,
                        ratings.ContainsKey(row.Id) ? Rating.FromNullable(rating) : null,
                        tagRefs ?? [],
                        creditRefs ?? [],
                        studio,
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
                        flag));
            })
            .ToArray();
    }

    private static IReadOnlyList<ICapability> BuildExplicitCapabilities(
        IEntityKind kind,
        string? description,
        Rating? rating,
        IReadOnlyList<EntityTag> tags,
        IReadOnlyList<EntityCredit> credits,
        EntityReference? studio,
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
        AddIfSupported(capabilities, kind, new CapabilityTags(tags));
        AddIfSupported(capabilities, kind, new CapabilityCredits(credits));
        AddIfSupported(capabilities, kind, new CapabilityStudio(studio));
        AddIfSupported(capabilities, kind, new CapabilityImages(kind.ImageAssetRoles, imageAssets, thumbnailUrl, coverUrl));
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
        if (kind.SupportedCapabilities.Any(supported => string.Equals(
                supported.Code,
                capability.Kind.Code,
                StringComparison.OrdinalIgnoreCase)))
        {
            capabilities.Add(capability);
        }
    }
}

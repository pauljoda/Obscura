using Obscura.Contracts.Collections;
using Obscura.Contracts.Entities;
using Obscura.Contracts.Media;
using Obscura.Contracts.Series;
using Obscura.Contracts.Taxonomy;
using Obscura.Contracts.Videos;
using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using System.Text.Json;
using DomainEntity = Obscura.Domain.Entities.Entity;
using DomainEntityPage = Obscura.Domain.Entities.EntityPage;
using DomainEntityReference = Obscura.Domain.Entities.EntityReference;
using ContractEntityCounter = Obscura.Contracts.Entities.EntityCounter;
using ContractEntityDate = Obscura.Contracts.Entities.EntityDate;
using ContractEntityExternalId = Obscura.Contracts.Entities.EntityExternalId;
using ContractEntityFile = Obscura.Contracts.Entities.EntityFile;
using ContractEntityFingerprint = Obscura.Contracts.Entities.EntityFingerprint;
using ContractEntityImageAsset = Obscura.Contracts.Entities.EntityImageAsset;
using ContractEntityMarker = Obscura.Contracts.Entities.EntityMarker;
using ContractEntityPosition = Obscura.Contracts.Entities.EntityPosition;
using ContractEntityReference = Obscura.Contracts.Entities.EntityReference;
using ContractEntityRelationshipGroup = Obscura.Contracts.Entities.EntityRelationshipGroup;
using ContractEntitySource = Obscura.Contracts.Entities.EntitySource;
using ContractEntityStat = Obscura.Contracts.Entities.EntityStat;
using ContractEntitySubtitle = Obscura.Contracts.Entities.EntitySubtitle;
using ContractEntityUrl = Obscura.Contracts.Entities.EntityUrl;
using ContractRating = Obscura.Contracts.Entities.Rating;

namespace Obscura.Application.Mapping;

/// <summary>
/// Contains shared entity and list-response contract mapping for v2 API routes.
/// </summary>
public static partial class ContractMapper
{
    /// <summary>
    /// Converts a domain entity page into the generic entity list response contract.
    /// </summary>
    /// <param name="page">Domain page returned by the entity catalog.</param>
    /// <returns>API contract page with entity cards.</returns>
    public static EntityListResponse ToEntityListResponse(DomainEntityPage page) =>
        new(page.Items.Select(ToEntityThumbnail).ToArray(), page.NextCursor);

    /// <summary>
    /// Converts a domain entity page into the video list response contract.
    /// </summary>
    /// <param name="page">Domain page containing video entities.</param>
    /// <returns>Video list contract for API callers.</returns>
    public static VideoListResponse ToVideoListResponse(DomainEntityPage page) =>
        new(page.Items.Select(ToEntityThumbnail).ToArray(), page.NextCursor);

    /// <summary>
    /// Converts a domain entity page into the video-series list response contract.
    /// </summary>
    /// <param name="page">Domain page containing video series entities.</param>
    /// <returns>Video-series list contract for API callers.</returns>
    public static VideoSeriesListResponse ToVideoSeriesListResponse(DomainEntityPage page) =>
        new(page.Items.Select(ToEntityThumbnail).ToArray(), page.NextCursor);

    /// <summary>
    /// Converts a domain entity page into the shared media list response contract.
    /// </summary>
    /// <param name="page">Domain page containing image, gallery, book, or audio entities.</param>
    /// <returns>Media list contract for API callers.</returns>
    public static MediaListResponse ToMediaListResponse(DomainEntityPage page) =>
        new(page.Items.Select(ToEntityThumbnail).ToArray(), page.NextCursor);

    /// <summary>
    /// Converts a domain entity page into the collection list response contract.
    /// </summary>
    /// <param name="page">Domain page containing collection entities.</param>
    /// <returns>Collection list contract for API callers.</returns>
    public static CollectionListResponse ToCollectionListResponse(DomainEntityPage page) =>
        new(page.Items.Select(ToEntityThumbnail).ToArray(), page.NextCursor);

    /// <summary>
    /// Converts a domain entity page into the taxonomy list response contract.
    /// </summary>
    /// <param name="page">Domain page containing person, studio, or tag entities.</param>
    /// <returns>Taxonomy list contract for API callers.</returns>
    public static TaxonomyListResponse ToTaxonomyListResponse(DomainEntityPage page) =>
        new(page.Items.Select(ToEntityThumbnail).ToArray(), page.NextCursor);

    /// <summary>
    /// Converts a domain entity root into the normalized card contract used by all list surfaces.
    /// </summary>
    /// <param name="entity">Domain entity root with shared capabilities.</param>
    /// <returns>API entity card contract.</returns>
    public static EntityCard ToEntityCard(DomainEntity entity) =>
        new(
            entity.Id,
            entity.Kind.Code,
            entity.Title,
            entity.ParentEntityId,
            entity.SortOrder,
            ToEntityCapabilities(entity.Capabilities),
            ToEntityChildGroups(entity.ChildrenByKind),
            ToEntityRelationshipGroups(entity.Relationships));

    public static EntityThumbnail ToEntityThumbnail(DomainEntity entity)
    {
        var images = entity.Images;
        var coverUrl = images?.ThumbnailUrl ??
            images?.CoverUrl ??
            images?.Items.FirstOrDefault(item =>
                item.Kind is EntityFileRole.Cover or EntityFileRole.Poster or EntityFileRole.Thumbnail)?.Path;
        var hover = images?.Items.FirstOrDefault(item => item.Kind == EntityFileRole.Trickplay);
        var rating = entity.TryGetCapability(CapabilityRegistry.Rating, out var ratingCapability)
            ? ratingCapability.Value?.Value
            : null;
        var flags = entity.TryGetCapability(CapabilityRegistry.Flags, out var flagCapability)
            ? flagCapability
            : CapabilityFlags.Empty;

        return new EntityThumbnail(
            entity.Id,
            entity.Kind.Code,
            entity.Title,
            entity.ParentEntityId,
            entity.SortOrder,
            coverUrl,
            hover is null ? "none" : "sprite",
            hover?.Path,
            BuildThumbnailMeta(entity),
            rating,
            flags.IsFavorite ?? false,
            flags.IsNsfw ?? false,
            flags.IsOrganized ?? false);
    }

    /// <summary>
    /// Converts a collection of domain entity roots into card contracts.
    /// </summary>
    /// <param name="entities">Domain entities to expose as cards.</param>
    /// <returns>Card contracts in the same order.</returns>
    public static IReadOnlyList<EntityCard> ToEntityCards(IReadOnlyList<DomainEntity> entities) =>
        entities.Select(ToEntityCard).ToArray();

    private static IReadOnlyList<EntityChildGroup> ToEntityChildGroups(IReadOnlyList<DomainEntity> children) =>
        children
            .GroupBy(child => child.Kind.Code, StringComparer.OrdinalIgnoreCase)
            .Select(group => new EntityChildGroup(group.Key, group.Select(child => child.Id).ToArray()))
            .ToArray();

    private static IReadOnlyList<EntityCapability> ToEntityCapabilities(IReadOnlyList<ICapability> capabilities) =>
        capabilities
            .Select(ToEntityCapability)
            .Where(capability => capability is not null)
            .Select(capability => capability!)
            .ToArray();

    private static IReadOnlyList<EntityChildGroup> ToEntityChildGroups(EntityChildren children) =>
        children.Sets
            .Select(set => new EntityChildGroup(set.Kind.Code, set.Items.Select(child => child.Id).ToArray()))
            .ToArray();

    public static IReadOnlyList<ContractEntityRelationshipGroup> ToEntityRelationshipGroups(EntityRelationships relationships) =>
        relationships.Groups
            .Select(group => new ContractEntityRelationshipGroup(
                group.Code,
                group.Kind.Code,
                group.Label,
                group.Items.Select(item => item.EntityId).ToArray()))
            .ToArray();

    public static IReadOnlyList<EntityCreditMetadata> ToCreditMetadata(DomainEntity entity) =>
        entity.Relationships.Groups
            .Where(group => string.Equals(group.Code, "cast", StringComparison.OrdinalIgnoreCase) &&
                string.Equals(group.Kind.Code, EntityKindRegistry.Person.Code, StringComparison.OrdinalIgnoreCase))
            .SelectMany(group => group.Items)
            .Select(item => ToCreditMetadata(item))
            .Where(item => item is not null)
            .Select(item => item!)
            .ToArray();

    private static EntityCapability? ToEntityCapability(ICapability capability) =>
        capability switch
        {
            CapabilityRating rating => new RatingCapability(
                rating.Value is null ? null : new ContractRating(rating.Value.Value)),
            CapabilityImages images => new ImagesCapability(
                images.SupportedKinds.Select(kind => kind.ToCode()).ToArray(),
                images.Items.Select(asset => new ContractEntityImageAsset(
                    asset.Kind.ToCode(),
                    asset.Path,
                    asset.MimeType)).ToArray(),
                images.ThumbnailUrl,
                images.CoverUrl),
            CapabilityDescription description => new DescriptionCapability(description.Value),
            CapabilityLinks links => new LinksCapability(
                links.Urls.Select(url => new ContractEntityUrl(url.Url, url.Label)).ToArray(),
                links.ExternalIds
                    .Select(externalId => new ContractEntityExternalId(externalId.Provider, externalId.Value, externalId.Url))
                    .ToArray()),
            CapabilityFlags flags => new FlagsCapability(flags.IsFavorite, flags.IsNsfw, flags.IsOrganized),
            CapabilityFiles files => new FilesCapability(files.Items.Select(file => new ContractEntityFile(
                file.Role.ToCode(),
                file.Path,
                file.MimeType)).ToArray()),
            CapabilityCounters counters => new CountersCapability(counters.Items.Select(counter => new ContractEntityCounter(
                counter.Code,
                counter.Value)).ToArray()),
            CapabilityFingerprints fingerprints => new FingerprintsCapability(fingerprints.Items.Select(fingerprint => new ContractEntityFingerprint(
                fingerprint.Algorithm.ToCode(),
                fingerprint.Value)).ToArray()),
            CapabilityMarkers markers => new MarkersCapability(markers.Items.Select(marker => new ContractEntityMarker(
                marker.Id,
                marker.Title,
                marker.Seconds,
                marker.EndSeconds)).ToArray()),
            CapabilitySubtitles subtitles => new SubtitlesCapability(subtitles.Items.Select(subtitle => new ContractEntitySubtitle(
                subtitle.Id,
                subtitle.Language,
                subtitle.Label,
                subtitle.Format,
                subtitle.Source.ToCode(),
                subtitle.StoragePath,
                subtitle.SourceFormat,
                subtitle.SourcePath,
                subtitle.IsDefault)).ToArray()),
            CapabilityStats stats => new StatsCapability(stats.Items.Select(stat => new ContractEntityStat(
                stat.Code,
                stat.Value)).ToArray()),
            CapabilityDates dates => new DatesCapability(dates.Items.Select(date => new ContractEntityDate(
                date.Code,
                date.Value,
                date.SortableValue,
                date.Precision)).ToArray()),
            CapabilityLifetime lifetime => new LifetimeCapability(
                lifetime.Start is null ? null : new ContractEntityDate(
                    lifetime.Start.Code,
                    lifetime.Start.Value,
                    lifetime.Start.SortableValue,
                    lifetime.Start.Precision),
                lifetime.End is null ? null : new ContractEntityDate(
                    lifetime.End.Code,
                    lifetime.End.Value,
                    lifetime.End.SortableValue,
                    lifetime.End.Precision),
                lifetime.Label),
            CapabilityTechnical technical => new TechnicalCapability(
                technical.Duration,
                technical.Width,
                technical.Height,
                technical.FrameRate,
                technical.BitRate,
                technical.SampleRate,
                technical.Channels,
                technical.Codec,
                technical.Container,
                technical.Format),
            CapabilitySource source => new SourceCapability(source.Items.Select(item => new ContractEntitySource(
                item.Code,
                item.Value)).ToArray()),
            CapabilityProgress progress => new ProgressCapability(
                progress.CurrentEntityId,
                progress.Unit,
                progress.Index,
                progress.Total,
                progress.Mode,
                progress.CompletedAt,
                progress.UpdatedAt),
            CapabilityPosition position => new PositionCapability(position.Items.Select(item => new ContractEntityPosition(
                item.Code,
                item.Value,
                item.Label)).ToArray()),
            CapabilityClassification classification => new ClassificationCapability(
                classification.Value,
                classification.System),
            CapabilityPlayback playback => new PlaybackCapability(
                playback.Value.PlayCount,
                playback.Value.PlayDuration.TotalSeconds,
                playback.Value.ResumeTime.TotalSeconds,
                playback.Value.LastPlayedAt,
                playback.Value.CompletedAt),
            _ => null
        };

    private static ContractEntityReference ToEntityReference(DomainEntityReference reference) =>
        new(reference.Id, reference.Kind.Code, reference.Title, reference.ThumbnailUrl);

    private static IReadOnlyList<EntityThumbnailMeta> BuildThumbnailMeta(DomainEntity entity)
    {
        var meta = new List<EntityThumbnailMeta>();
        if (entity.Technical?.Duration is { } duration)
        {
            meta.Add(new EntityThumbnailMeta("duration", FormatDuration(duration)));
        }

        if (entity.Technical is { Width: { } width, Height: { } height })
        {
            meta.Add(new EntityThumbnailMeta(entity.Kind.Code == EntityKindRegistry.Video.Code ? "video" : "image", FormatResolution(height, width)));
        }

        if (entity.Position?.Items.FirstOrDefault() is { } position)
        {
            meta.Add(new EntityThumbnailMeta("count", position.Label ?? $"{position.Code} {position.Value}"));
        }

        return meta.Take(3).ToArray();
    }

    private static string FormatDuration(TimeSpan duration) =>
        duration.TotalHours >= 1
            ? $"{(int)duration.TotalHours}:{duration.Minutes:00}:{duration.Seconds:00}"
            : $"{duration.Minutes:00}:{duration.Seconds:00}";

    private static string FormatResolution(int height, int width) =>
        height >= 2160 ? "4K" :
        height >= 1440 ? "1440p" :
        height >= 1080 ? "1080p" :
        height >= 720 ? "720p" :
        $"{width}x{height}";

    private static EntityCreditMetadata? ToCreditMetadata(EntityRelationshipItem item)
    {
        if (string.IsNullOrWhiteSpace(item.MetadataJson))
        {
            return new EntityCreditMetadata(item.EntityId, null, null);
        }

        using var document = JsonDocument.Parse(item.MetadataJson);
        var root = document.RootElement;
        var role = root.TryGetProperty("role", out var roleElement) ? roleElement.GetString() : null;
        var character = root.TryGetProperty("character", out var characterElement) ? characterElement.GetString() : null;
        return new EntityCreditMetadata(item.EntityId, role, character);
    }
}

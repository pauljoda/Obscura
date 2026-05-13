using Obscura.Contracts.Collections;
using Obscura.Contracts.Entities;
using Obscura.Contracts.Media;
using Obscura.Contracts.Series;
using Obscura.Contracts.Taxonomy;
using Obscura.Contracts.Videos;
using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
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
using ContractEntitySource = Obscura.Contracts.Entities.EntitySource;
using ContractEntityStat = Obscura.Contracts.Entities.EntityStat;
using ContractEntitySubtitle = Obscura.Contracts.Entities.EntitySubtitle;
using ContractEntityUrl = Obscura.Contracts.Entities.EntityUrl;
using ContractRating = Obscura.Contracts.Entities.Rating;

namespace Obscura.Api.Mapping;

public static partial class ContractMapper
{
    public static EntityListResponse ToEntityListResponse(DomainEntityPage page) =>
        new(page.Items.Select(ToEntityCard).ToArray(), page.NextCursor);

    public static VideoListResponse ToVideoListResponse(DomainEntityPage page) =>
        new(page.Items.Select(ToEntityCard).ToArray(), page.NextCursor);

    public static VideoSeriesListResponse ToVideoSeriesListResponse(DomainEntityPage page) =>
        new(page.Items.Select(ToEntityCard).ToArray(), page.NextCursor);

    public static MediaListResponse ToMediaListResponse(DomainEntityPage page) =>
        new(page.Items.Select(ToEntityCard).ToArray(), page.NextCursor);

    public static CollectionListResponse ToCollectionListResponse(DomainEntityPage page) =>
        new(page.Items.Select(ToEntityCard).ToArray(), page.NextCursor);

    public static TaxonomyListResponse ToTaxonomyListResponse(DomainEntityPage page) =>
        new(page.Items.Select(ToEntityCard).ToArray(), page.NextCursor);

    public static EntityCard ToEntityCard(DomainEntity entity) =>
        new(
            entity.Id,
            entity.Kind.Code,
            entity.Title,
            entity.Subtitle,
            ToEntityCapabilities(entity.Capabilities));

    public static IReadOnlyList<EntityCard> ToEntityCards(IReadOnlyList<DomainEntity> entities) =>
        entities.Select(ToEntityCard).ToArray();

    private static IReadOnlyList<EntityCapability> ToEntityCapabilities(IReadOnlyList<ICapability> capabilities) =>
        capabilities
            .Select(ToEntityCapability)
            .Where(capability => capability is not null)
            .Select(capability => capability!)
            .ToArray();

    private static EntityCapability? ToEntityCapability(ICapability capability) =>
        capability switch
        {
            CapabilityRating rating => new RatingCapability(
                rating.Value is null ? null : new ContractRating(rating.Value.Value)),
            CapabilityTags tags => new TagsCapability(tags.Values),
            CapabilityCredits credits => new CreditsCapability(credits.People.Select(ToEntityReference).ToArray()),
            CapabilityStudio studio => new StudioCapability(studio.Value is null ? null : ToEntityReference(studio.Value)),
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
                fingerprint.Algorithm,
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
            _ => null
        };

    private static ContractEntityReference ToEntityReference(DomainEntityReference reference) =>
        new(reference.Id, reference.Kind.Code, reference.Title);
}

using Obscura.Contracts.Collections;
using Obscura.Contracts.Entities;
using Obscura.Contracts.Media;
using Obscura.Contracts.Series;
using Obscura.Contracts.Taxonomy;
using Obscura.Contracts.Videos;
using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using DomainEntity = Obscura.Domain.Entities.Entity;
using DomainEntityLibrary = Obscura.Domain.Media.EntityLibrary;
using DomainEntityPage = Obscura.Domain.Entities.EntityPage;
using DomainEntityReference = Obscura.Domain.Entities.EntityReference;
using ContractEntityExternalId = Obscura.Contracts.Entities.EntityExternalId;
using ContractEntityFile = Obscura.Contracts.Entities.EntityFile;
using ContractEntityCounter = Obscura.Contracts.Entities.EntityCounter;
using ContractEntityFingerprint = Obscura.Contracts.Entities.EntityFingerprint;
using ContractEntityImageAsset = Obscura.Contracts.Entities.EntityImageAsset;
using ContractEntityMarker = Obscura.Contracts.Entities.EntityMarker;
using ContractEntityPosition = Obscura.Contracts.Entities.EntityPosition;
using ContractEntitySource = Obscura.Contracts.Entities.EntitySource;
using ContractEntityStat = Obscura.Contracts.Entities.EntityStat;
using ContractEntityDate = Obscura.Contracts.Entities.EntityDate;
using ContractEntitySubtitle = Obscura.Contracts.Entities.EntitySubtitle;
using ContractEntityUrl = Obscura.Contracts.Entities.EntityUrl;
using ContractRating = Obscura.Contracts.Entities.Rating;
using DomainMarker = Obscura.Domain.Capabilities.EntityMarker;
using DomainSubtitle = Obscura.Domain.Capabilities.EntitySubtitle;
using DomainVideo = Obscura.Domain.Media.Video;
using DomainVideoSeries = Obscura.Domain.Media.VideoSeries;
using DomainAudioLibrary = Obscura.Domain.Media.AudioLibrary;
using DomainAudioTrack = Obscura.Domain.Media.AudioTrack;
using DomainBook = Obscura.Domain.Media.Book;
using DomainCollection = Obscura.Domain.Media.Collection;
using DomainGallery = Obscura.Domain.Media.Gallery;
using DomainPerson = Obscura.Domain.Taxonomy.Person;
using DomainStudio = Obscura.Domain.Taxonomy.Studio;
using DomainTag = Obscura.Domain.Taxonomy.Tag;

namespace Obscura.Api.Mapping;

/// <summary>
/// Converts internal Domain objects into public API contracts that OpenAPI and Orval expose to Svelte.
/// </summary>
public static class ContractMapper
{
    /// <summary>
    /// Converts a domain entity page into the generic entity list response contract.
    /// </summary>
    /// <param name="page">Domain page returned by the entity catalog.</param>
    /// <returns>API contract page with entity cards.</returns>
    public static EntityListResponse ToEntityListResponse(DomainEntityPage page) =>
        new(page.Items.Select(ToEntityCard).ToArray(), page.NextCursor);

    /// <summary>
    /// Converts a domain entity page into the video list response contract.
    /// </summary>
    /// <param name="page">Domain page containing video entities.</param>
    /// <returns>Video list contract for API callers.</returns>
    public static VideoListResponse ToVideoListResponse(DomainEntityPage page) =>
        new(page.Items.Select(ToEntityCard).ToArray(), page.NextCursor);

    /// <summary>
    /// Converts a domain entity page into the video-series list response contract.
    /// </summary>
    /// <param name="page">Domain page containing video series entities.</param>
    /// <returns>Video-series list contract for API callers.</returns>
    public static VideoSeriesListResponse ToVideoSeriesListResponse(DomainEntityPage page) =>
        new(page.Items.Select(ToEntityCard).ToArray(), page.NextCursor);

    /// <summary>
    /// Converts a domain entity page into the shared media list response contract.
    /// </summary>
    /// <param name="page">Domain page containing media entities.</param>
    /// <returns>Media list contract for API callers.</returns>
    public static MediaListResponse ToMediaListResponse(DomainEntityPage page) =>
        new(page.Items.Select(ToEntityCard).ToArray(), page.NextCursor);

    /// <summary>
    /// Converts a domain entity page into the collection list response contract.
    /// </summary>
    /// <param name="page">Domain page containing collection entities.</param>
    /// <returns>Collection list contract for API callers.</returns>
    public static CollectionListResponse ToCollectionListResponse(DomainEntityPage page) =>
        new(page.Items.Select(ToEntityCard).ToArray(), page.NextCursor);

    /// <summary>
    /// Converts a domain entity page into the taxonomy list response contract.
    /// </summary>
    /// <param name="page">Domain page containing person, studio, or tag entities.</param>
    /// <returns>Taxonomy list contract for API callers.</returns>
    public static TaxonomyListResponse ToTaxonomyListResponse(DomainEntityPage page) =>
        new(page.Items.Select(ToEntityCard).ToArray(), page.NextCursor);

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
            entity.Subtitle,
            ToEntityCapabilities(entity.Capabilities));

    /// <summary>
    /// Converts a collection of domain entity roots into card contracts.
    /// </summary>
    /// <param name="entities">Domain entities to expose as cards.</param>
    /// <returns>Card contracts in the same order.</returns>
    public static IReadOnlyList<EntityCard> ToEntityCards(IReadOnlyList<DomainEntity> entities) =>
        entities.Select(ToEntityCard).ToArray();

    /// <summary>
    /// Converts a media entity and optional child entities into the shared media detail contract.
    /// </summary>
    /// <param name="entity">Domain entity root for the media item.</param>
    /// <param name="children">Projected child entities, such as gallery images or album tracks.</param>
    /// <returns>Media detail contract for API callers.</returns>
    public static MediaDetail ToMediaDetail(DomainEntity entity, IReadOnlyList<DomainEntity> children) =>
        new(
            entity.Id,
            entity.Kind.Code,
            entity.Title,
            ToEntityCapabilities(entity.Capabilities),
            ToEntityCards(children),
            GalleryType: entity is DomainGallery gallery ? gallery.GalleryType.ToCode() : null,
            CoverImageId: entity is DomainGallery galleryWithCover ? galleryWithCover.CoverImageId : null,
            BookType: entity is DomainBook book ? book.BookType.ToCode() : null,
            CoverPageId: entity is DomainBook bookWithCover ? bookWithCover.CoverPageId : null,
            ParentLibraryId: entity is DomainAudioLibrary library ? library.ParentLibraryId : null,
            EmbeddedArtist: entity is DomainAudioTrack track ? track.EmbeddedArtist : null,
            EmbeddedAlbum: entity is DomainAudioTrack trackWithAlbum ? trackWithAlbum.EmbeddedAlbum : null);

    /// <summary>
    /// Converts a generic entity library aggregate into the collection detail contract.
    /// </summary>
    /// <param name="library">Domain aggregate containing the collection root and linked members.</param>
    /// <returns>Collection detail contract for API callers.</returns>
    public static CollectionDetail ToCollectionDetail(DomainEntityLibrary library) =>
        new(
            library.Entity.Id,
            library.Entity.Kind.Code,
            library.Entity.Title,
            ToEntityCapabilities(library.Entity.Capabilities),
            ToEntityCards(library.Children));

    /// <summary>
    /// Converts a typed collection aggregate into the collection detail contract.
    /// </summary>
    /// <param name="collection">Collection aggregate with ordered member entities.</param>
    /// <returns>Collection detail contract with collection-specific fields.</returns>
    public static CollectionDetail ToCollectionDetail(DomainCollection collection) =>
        new(
            collection.Id,
            collection.Kind.Code,
            collection.Title,
            ToEntityCapabilities(collection.Capabilities),
            ToEntityCards(collection.Items),
            collection.Mode.ToCode(),
            collection.RuleTreeJson,
            collection.CoverMode.ToCode(),
            collection.CoverItemId,
            collection.SlideshowDuration,
            collection.SlideshowAutoAdvance,
            collection.LastRefreshedAt);

    /// <summary>
    /// Converts a taxonomy entity into its detail contract.
    /// </summary>
    /// <param name="entity">Domain entity root for the taxonomy item.</param>
    /// <returns>Taxonomy detail contract for API callers.</returns>
    public static TaxonomyDetail ToTaxonomyDetail(DomainEntity entity) =>
        new(
            entity.Id,
            entity.Kind.Code,
            entity.Title,
            ToEntityCapabilities(entity.Capabilities),
            Disambiguation: entity is DomainPerson person ? person.Disambiguation : null,
            Gender: entity is DomainPerson genderedPerson ? genderedPerson.Gender : null,
            Birthdate: entity is DomainPerson birthdatedPerson ? birthdatedPerson.Birthdate : null,
            Country: entity is DomainPerson countryPerson ? countryPerson.Country : null,
            Ethnicity: entity is DomainPerson ethnicityPerson ? ethnicityPerson.Ethnicity : null,
            EyeColor: entity is DomainPerson eyeColorPerson ? eyeColorPerson.EyeColor : null,
            HairColor: entity is DomainPerson hairColorPerson ? hairColorPerson.HairColor : null,
            Height: entity is DomainPerson heightPerson ? heightPerson.Height : null,
            Weight: entity is DomainPerson weightPerson ? weightPerson.Weight : null,
            Measurements: entity is DomainPerson measurementsPerson ? measurementsPerson.Measurements : null,
            Tattoos: entity is DomainPerson tattooedPerson ? tattooedPerson.Tattoos : null,
            Piercings: entity is DomainPerson piercedPerson ? piercedPerson.Piercings : null,
            CareerStart: entity is DomainPerson careerStartPerson ? careerStartPerson.CareerStart : null,
            CareerEnd: entity is DomainPerson careerEndPerson ? careerEndPerson.CareerEnd : null,
            ParentStudioId: entity is DomainStudio studio ? studio.ParentStudioId : null,
            ParentTagId: entity is DomainTag tag ? tag.ParentTagId : null,
            IgnoreAutoTag: entity is DomainTag tagWithAutomation ? tagWithAutomation.IgnoreAutoTag : null);

    /// <summary>
    /// Converts a video aggregate into the video detail contract.
    /// </summary>
    /// <param name="video">Domain video aggregate with playback metadata and shared capabilities.</param>
    /// <returns>Video detail contract for API callers.</returns>
    public static VideoDetail ToVideoDetail(DomainVideo video) =>
        new(
            video.Id,
            video.Kind.Code,
            video.Title,
            video.Description,
            video.Technical?.Duration,
            video.Technical?.Width,
            video.Technical?.Height,
            video.MarkerCapability?.Items.Select(ToVideoMarker).ToArray() ?? [],
            video.SubtitleCapability?.Items.Select(ToVideoSubtitle).ToArray() ?? [],
            ToEntityCapabilities(video.Capabilities));

    /// <summary>
    /// Converts a video-series aggregate into the series detail contract.
    /// </summary>
    /// <param name="series">Domain series aggregate with child links and shared capabilities.</param>
    /// <returns>Video-series detail contract for API callers.</returns>
    public static VideoSeriesDetail ToVideoSeriesDetail(DomainVideoSeries series) =>
        new(
            series.Id,
            series.Kind.Code,
            series.Title,
            series.Description,
            ToEntityCapabilities(series.Capabilities),
            ToEntityCards(series.Children),
            ToEntityCards(series.Videos),
            series.RenderingMode.ToCode());

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

    private static Obscura.Contracts.Entities.EntityReference ToEntityReference(DomainEntityReference reference) =>
        new(reference.Id, reference.Kind.Code, reference.Title);

    private static VideoMarker ToVideoMarker(DomainMarker marker) =>
        new(marker.Id, marker.Title, marker.Seconds, marker.EndSeconds);

    private static VideoSubtitle ToVideoSubtitle(DomainSubtitle subtitle) =>
        new(
            subtitle.Id,
            subtitle.Language,
            subtitle.Label,
            subtitle.Format,
            subtitle.Source.ToCode(),
            subtitle.StoragePath,
            subtitle.SourceFormat,
            subtitle.SourcePath,
            subtitle.IsDefault);
}

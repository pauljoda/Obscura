using Obscura.Contracts.Collections;
using Obscura.Contracts.Entities;
using Obscura.Contracts.Media;
using Obscura.Contracts.Series;
using Obscura.Contracts.Taxonomy;
using Obscura.Contracts.Videos;
using Obscura.Domain.Entities;
using DomainCapabilities = Obscura.Domain.Capabilities.EntityCapabilities;
using DomainEntity = Obscura.Domain.Entities.Entity;
using DomainEntityLibrary = Obscura.Domain.Media.EntityLibrary;
using DomainEntityPage = Obscura.Domain.Entities.EntityPage;
using DomainEntityReference = Obscura.Domain.Entities.EntityReference;
using DomainMarker = Obscura.Domain.Capabilities.EntityMarker;
using DomainSubtitle = Obscura.Domain.Capabilities.EntitySubtitle;
using DomainVideo = Obscura.Domain.Media.Video;
using DomainVideoSeries = Obscura.Domain.Media.VideoSeries;

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
            ToEntityCards(children));

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
    /// Converts a taxonomy entity into its detail contract.
    /// </summary>
    /// <param name="entity">Domain entity root for the taxonomy item.</param>
    /// <returns>Taxonomy detail contract for API callers.</returns>
    public static TaxonomyDetail ToTaxonomyDetail(DomainEntity entity) =>
        new(
            entity.Id,
            entity.Kind.Code,
            entity.Title,
            ToEntityCapabilities(entity.Capabilities));

    /// <summary>
    /// Converts a video aggregate into the video detail contract.
    /// </summary>
    /// <param name="video">Domain video aggregate with playback metadata and shared capabilities.</param>
    /// <returns>Video detail contract for API callers.</returns>
    public static VideoDetail ToVideoDetail(DomainVideo video) =>
        new(
            video.Entity.Id,
            video.Entity.Kind.Code,
            video.Entity.Title,
            video.Summary,
            video.Duration,
            video.Width,
            video.Height,
            video.Markers.Items.Select(ToVideoMarker).ToArray(),
            video.Subtitles.Items.Select(ToVideoSubtitle).ToArray(),
            ToEntityCapabilities(video.Entity.Capabilities));

    /// <summary>
    /// Converts a video-series aggregate into the series detail contract.
    /// </summary>
    /// <param name="series">Domain series aggregate with child links and shared capabilities.</param>
    /// <returns>Video-series detail contract for API callers.</returns>
    public static VideoSeriesDetail ToVideoSeriesDetail(DomainVideoSeries series) =>
        new(
            series.Entity.Id,
            series.Entity.Kind.Code,
            series.Entity.Title,
            series.Summary,
            ToEntityCapabilities(series.Entity.Capabilities),
            ToEntityCards(series.Children),
            ToEntityCards(series.Videos),
            series.RenderingMode.ToCode());

    private static EntityCapabilities ToEntityCapabilities(DomainCapabilities capabilities) =>
        new(
            capabilities.Rating is null ? null : new Rating(capabilities.Rating.Value.Value),
            capabilities.Tags.Values,
            capabilities.Credits.People.Select(ToEntityReference).ToArray(),
            capabilities.Studio is null ? null : ToEntityReference(capabilities.Studio),
            capabilities.Links.Urls.Select(url => new EntityUrl(url.Url, url.Label)).ToArray(),
            capabilities.Links.ExternalIds
                .Select(externalId => new EntityExternalId(externalId.Provider, externalId.Value, externalId.Url))
                .ToArray(),
            capabilities.Images.ThumbnailUrl,
            capabilities.Images.CoverUrl,
            capabilities.Flags.IsFavorite,
            capabilities.Flags.IsNsfw,
            capabilities.Flags.IsOrganized);

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

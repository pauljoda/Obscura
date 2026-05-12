using Obscura.Contracts.Collections;
using Obscura.Contracts.Entities;
using Obscura.Contracts.Media;
using Obscura.Contracts.Series;
using Obscura.Contracts.Taxonomy;
using Obscura.Contracts.Videos;
using DomainCapabilities = Obscura.Domain.Capabilities.EntityCapabilities;
using DomainEntity = Obscura.Domain.Entities.Entity;
using DomainEntityPage = Obscura.Domain.Entities.EntityPage;
using DomainEntityReference = Obscura.Domain.Entities.EntityReference;
using DomainMarker = Obscura.Domain.Capabilities.EntityMarker;
using DomainSubtitle = Obscura.Domain.Capabilities.EntitySubtitle;
using DomainVideo = Obscura.Domain.Media.Video;
using DomainVideoSeries = Obscura.Domain.Media.VideoSeries;

namespace Obscura.Api.Mapping;

public static class ContractMapper
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

    public static MediaDetail ToMediaDetail(DomainEntity entity, IReadOnlyList<DomainEntity> children) =>
        new(
            entity.Id,
            entity.Kind.Code,
            entity.Title,
            ToEntityCapabilities(entity.Capabilities),
            ToEntityCards(children));

    public static CollectionDetail ToCollectionDetail(DomainEntity entity, IReadOnlyList<DomainEntity> items) =>
        new(
            entity.Id,
            entity.Kind.Code,
            entity.Title,
            ToEntityCapabilities(entity.Capabilities),
            ToEntityCards(items));

    public static TaxonomyDetail ToTaxonomyDetail(DomainEntity entity) =>
        new(
            entity.Id,
            entity.Kind.Code,
            entity.Title,
            ToEntityCapabilities(entity.Capabilities));

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

    public static VideoSeriesDetail ToVideoSeriesDetail(DomainVideoSeries series) =>
        new(
            series.Entity.Id,
            series.Entity.Kind.Code,
            series.Entity.Title,
            series.Summary,
            ToEntityCapabilities(series.Entity.Capabilities),
            ToEntityCards(series.Children),
            ToEntityCards(series.Videos),
            series.RenderingMode);

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

    private static EntityReference ToEntityReference(DomainEntityReference reference) =>
        new(reference.Id, reference.Kind.Code, reference.Title);

    private static VideoMarker ToVideoMarker(DomainMarker marker) =>
        new(marker.Id, marker.Title, marker.Seconds, marker.EndSeconds);

    private static VideoSubtitle ToVideoSubtitle(DomainSubtitle subtitle) =>
        new(
            subtitle.Id,
            subtitle.Language,
            subtitle.Label,
            subtitle.Format,
            subtitle.Source,
            subtitle.StoragePath,
            subtitle.SourceFormat,
            subtitle.SourcePath,
            subtitle.IsDefault);
}

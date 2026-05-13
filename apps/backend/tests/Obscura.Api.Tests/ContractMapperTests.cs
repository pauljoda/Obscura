using System.Text.Json;
using Obscura.Api.Mapping;
using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using Obscura.Domain.Media;
using Obscura.Domain.Taxonomy;

namespace Obscura.Api.Tests;

public sealed class ContractMapperTests
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [Fact]
    public void VideoDetailSerializesDescriptionInsteadOfLegacySummary()
    {
        var video = new Video(
            new Entity(
                Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                EntityKindRegistry.Video,
                "Mapped Video",
                null,
                [
                    new CapabilityDescription("Capability description")
                ]),
            SubtitlesExtractedAt: null);

        using var document = JsonDocument.Parse(JsonSerializer.Serialize(ContractMapper.ToVideoDetail(video), JsonOptions));

        Assert.True(document.RootElement.TryGetProperty("description", out var description));
        Assert.Equal("Capability description", description.GetString());
        Assert.False(document.RootElement.TryGetProperty("summary", out _));
    }

    [Fact]
    public void VideoSeriesDetailSerializesDescriptionInsteadOfLegacySummary()
    {
        var series = new VideoSeries(
            new Entity(
                Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                EntityKindRegistry.VideoSeries,
                "Mapped Series",
                null,
                [
                    new CapabilityDescription("Series description")
                ]),
            Status: null,
            VideoSeriesRenderingMode.Flat,
            children: [],
            videos: []);

        using var document = JsonDocument.Parse(JsonSerializer.Serialize(ContractMapper.ToVideoSeriesDetail(series), JsonOptions));

        Assert.True(document.RootElement.TryGetProperty("description", out var description));
        Assert.Equal("Series description", description.GetString());
        Assert.False(document.RootElement.TryGetProperty("summary", out _));
    }

    [Fact]
    public void MediaDetailSerializesTypedMediaFields()
    {
        var gallery = new Gallery(
            new Entity(
                Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"),
                EntityKindRegistry.Gallery,
                "Mapped Gallery",
                null,
                []),
            GalleryType.Folder,
            Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd"));

        using var document = JsonDocument.Parse(JsonSerializer.Serialize(ContractMapper.ToMediaDetail(gallery, []), JsonOptions));

        Assert.Equal("folder", document.RootElement.GetProperty("galleryType").GetString());
        Assert.Equal("dddddddd-dddd-dddd-dddd-dddddddddddd", document.RootElement.GetProperty("coverImageId").GetGuid().ToString());
    }

    [Fact]
    public void TaxonomyDetailSerializesTypedTaxonomyFields()
    {
        var tag = new Tag(
            new Entity(
                Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"),
                EntityKindRegistry.Tag,
                "Mapped Tag",
                null,
                []),
            Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff"),
            IgnoreAutoTag: true);

        using var document = JsonDocument.Parse(JsonSerializer.Serialize(ContractMapper.ToTaxonomyDetail(tag), JsonOptions));

        Assert.Equal("ffffffff-ffff-ffff-ffff-ffffffffffff", document.RootElement.GetProperty("parentTagId").GetGuid().ToString());
        Assert.True(document.RootElement.GetProperty("ignoreAutoTag").GetBoolean());
    }

    [Fact]
    public void CollectionDetailSerializesTypedCollectionFields()
    {
        var collection = new Collection(
            new Entity(
                Guid.Parse("99999999-9999-9999-9999-999999999999"),
                EntityKindRegistry.Collection,
                "Mapped Collection",
                null,
                []),
            CollectionMode.Dynamic,
            "{\"rules\":[]}",
            CollectionCoverMode.Item,
            Guid.Parse("12121212-1212-1212-1212-121212121212"),
            TimeSpan.FromSeconds(7),
            SlideshowAutoAdvance: false,
            LastRefreshedAt: DateTimeOffset.Parse("2026-05-13T12:00:00Z"),
            items: []);

        using var document = JsonDocument.Parse(JsonSerializer.Serialize(ContractMapper.ToCollectionDetail(collection), JsonOptions));

        Assert.Equal("dynamic", document.RootElement.GetProperty("mode").GetString());
        Assert.Equal("item", document.RootElement.GetProperty("coverMode").GetString());
        Assert.Equal("12121212-1212-1212-1212-121212121212", document.RootElement.GetProperty("coverItemId").GetGuid().ToString());
        Assert.False(document.RootElement.GetProperty("slideshowAutoAdvance").GetBoolean());
    }
}

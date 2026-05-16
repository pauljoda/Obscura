using System.Text.Json;
using Obscura.Application.Mapping;
using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using Obscura.Domain.Media;
using Obscura.Domain.Taxonomy;

namespace Obscura.Api.Tests;

public sealed class ContractMapperTests
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [Fact]
    public void VideoDetailKeepsSharedDescriptionInsideCapabilities()
    {
        var video = new Video(
            new Entity(
                Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                EntityKindRegistry.Video,
                "Mapped Video",
                [
                    new CapabilityDescription("Capability description")
                ]),
            SubtitlesExtractedAt: null);

        using var document = JsonDocument.Parse(JsonSerializer.Serialize(ContractMapper.ToVideoDetail(video), JsonOptions));

        Assert.False(document.RootElement.TryGetProperty("description", out _));
        Assert.False(document.RootElement.TryGetProperty("summary", out _));
        Assert.Equal(
            "description",
            document.RootElement
                .GetProperty("capabilities")
                .EnumerateArray()
                .Single()
                .GetProperty("kind")
                .GetString());
    }

    [Fact]
    public void EntityCardSerializesTagCapabilityWithReferences()
    {
        var tagId = Guid.Parse("12121212-1212-1212-1212-121212121212");
        var video = new Entity(
            Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            EntityKindRegistry.Video,
            "Mapped Video",
            [
                new CapabilityTags([
                    new EntityTag(new Obscura.Domain.Entities.EntityReference(tagId, EntityKindRegistry.Tag, "Comedy"))
                ])
            ]);

        using var document = JsonDocument.Parse(JsonSerializer.Serialize(ContractMapper.ToEntityCard(video), JsonOptions));
        var tags = document.RootElement
            .GetProperty("capabilities")
            .EnumerateArray()
            .Single(capability => capability.GetProperty("kind").GetString() == "tags");

        Assert.Equal("Comedy", tags.GetProperty("values").EnumerateArray().Single().GetString());
        var item = tags.GetProperty("items").EnumerateArray().Single();
        Assert.Equal(tagId, item.GetProperty("id").GetGuid());
        Assert.Equal("tag", item.GetProperty("kind").GetString());
        Assert.Equal("Comedy", item.GetProperty("title").GetString());
    }

    [Fact]
    public void VideoSeriesDetailKeepsSharedDescriptionInsideCapabilities()
    {
        var series = new VideoSeries(
            new Entity(
                Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                EntityKindRegistry.VideoSeries,
                "Mapped Series",
                [
                    new CapabilityDescription("Series description")
                ]),
            Status: null,
            VideoSeriesRenderingMode.Flat,
            children: [],
            videos: []);

        using var document = JsonDocument.Parse(JsonSerializer.Serialize(ContractMapper.ToVideoSeriesDetail(series), JsonOptions));

        Assert.False(document.RootElement.TryGetProperty("description", out _));
        Assert.False(document.RootElement.TryGetProperty("summary", out _));
        Assert.Equal(
            "description",
            document.RootElement
                .GetProperty("capabilities")
                .EnumerateArray()
                .Single()
                .GetProperty("kind")
                .GetString());
    }

    [Fact]
    public void GalleryDetailSerializesOnlyGalleryFields()
    {
        var gallery = new Gallery(
            new Entity(
                Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"),
                EntityKindRegistry.Gallery,
                "Mapped Gallery",
                []),
            GalleryType.Folder,
            Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd"));

        using var document = JsonDocument.Parse(JsonSerializer.Serialize(ContractMapper.ToGalleryDetail(gallery, []), JsonOptions));

        Assert.Equal("folder", document.RootElement.GetProperty("galleryType").GetString());
        Assert.Equal("dddddddd-dddd-dddd-dddd-dddddddddddd", document.RootElement.GetProperty("coverImageId").GetGuid().ToString());
        Assert.False(document.RootElement.TryGetProperty("bookType", out _));
        Assert.False(document.RootElement.TryGetProperty("embeddedArtist", out _));
    }

    [Fact]
    public void TagDetailSerializesOnlyTagFields()
    {
        var tag = new Tag(
            new Entity(
                Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"),
                EntityKindRegistry.Tag,
                "Mapped Tag",
                []),
            Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff"),
            IgnoreAutoTag: true);

        using var document = JsonDocument.Parse(JsonSerializer.Serialize(ContractMapper.ToTagDetail(tag), JsonOptions));

        Assert.Equal("ffffffff-ffff-ffff-ffff-ffffffffffff", document.RootElement.GetProperty("parentTagId").GetGuid().ToString());
        Assert.True(document.RootElement.GetProperty("ignoreAutoTag").GetBoolean());
        Assert.False(document.RootElement.TryGetProperty("gender", out _));
        Assert.False(document.RootElement.TryGetProperty("parentStudioId", out _));
    }

    [Fact]
    public void CollectionDetailSerializesTypedCollectionFields()
    {
        var collection = new Collection(
            new Entity(
                Guid.Parse("99999999-9999-9999-9999-999999999999"),
                EntityKindRegistry.Collection,
                "Mapped Collection",
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

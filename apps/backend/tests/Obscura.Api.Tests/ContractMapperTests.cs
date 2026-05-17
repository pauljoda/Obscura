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
    public void EntityCardSerializesChildAndRelationshipIds()
    {
        var tagId = Guid.Parse("12121212-1212-1212-1212-121212121212");
        var episodeId = Guid.Parse("23232323-2323-2323-2323-232323232323");
        var video = new Entity(
            Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            EntityKindRegistry.Video,
            "Mapped Video",
            [],
            parentEntityId: Guid.Parse("34343434-3434-3434-3434-343434343434"),
            children: new EntityChildren([
                new EntityChildSet(EntityKindRegistry.Video, [
                    new Entity(episodeId, EntityKindRegistry.Video, "Episode", [])
                ])
            ]),
            relationships: new EntityRelationships([
                new Obscura.Domain.Entities.EntityRelationshipGroup(
                    "tags",
                    EntityKindRegistry.Tag,
                    "Tags",
                    [new EntityRelationshipItem(tagId, null)])
            ]));

        using var document = JsonDocument.Parse(JsonSerializer.Serialize(ContractMapper.ToEntityCard(video), JsonOptions));
        Assert.Equal("34343434-3434-3434-3434-343434343434", document.RootElement.GetProperty("parentEntityId").GetGuid().ToString());
        var childGroup = document.RootElement.GetProperty("childrenByKind").EnumerateArray().Single();
        Assert.Equal("video", childGroup.GetProperty("kind").GetString());
        Assert.Equal(episodeId, childGroup.GetProperty("entityIds").EnumerateArray().Single().GetGuid());
        var tags = document.RootElement.GetProperty("relationships").EnumerateArray().Single();
        Assert.Equal("tags", tags.GetProperty("code").GetString());
        Assert.Equal("tag", tags.GetProperty("kind").GetString());
        Assert.Equal("Tags", tags.GetProperty("label").GetString());
        Assert.Equal(tagId, tags.GetProperty("entityIds").EnumerateArray().Single().GetGuid());
    }

    [Fact]
    public void EntityCardSerializesLifetimeCapabilityDiscriminator()
    {
        var series = new Entity(
            Guid.Parse("abababab-abab-abab-abab-abababababab"),
            EntityKindRegistry.VideoSeries,
            "Mapped Series",
            [
                new CapabilityLifetime(
                    new Obscura.Domain.Capabilities.EntityDate("first-air", "2020", new DateOnly(2020, 1, 1), "year"),
                    new Obscura.Domain.Capabilities.EntityDate("end-air", "2024", new DateOnly(2024, 1, 1), "year"),
                    "Aired")
            ]);

        using var document = JsonDocument.Parse(JsonSerializer.Serialize(ContractMapper.ToEntityCard(series), JsonOptions));
        var lifetime = document.RootElement
            .GetProperty("capabilities")
            .EnumerateArray()
            .Single(capability => capability.GetProperty("kind").GetString() == "lifetime");

        Assert.Equal("first-air", lifetime.GetProperty("start").GetProperty("code").GetString());
        Assert.Equal("end-air", lifetime.GetProperty("end").GetProperty("code").GetString());
        Assert.Equal("Aired", lifetime.GetProperty("label").GetString());
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
                [],
                parentEntityId: Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff")),
            IgnoreAutoTag: true);

        using var document = JsonDocument.Parse(JsonSerializer.Serialize(ContractMapper.ToTagDetail(tag), JsonOptions));

        Assert.True(document.RootElement.GetProperty("ignoreAutoTag").GetBoolean());
        Assert.False(document.RootElement.TryGetProperty("parentTagId", out _));
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

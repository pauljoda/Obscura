using System.Text.Json;
using Obscura.Api.Mapping;
using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using Obscura.Domain.Media;

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
}

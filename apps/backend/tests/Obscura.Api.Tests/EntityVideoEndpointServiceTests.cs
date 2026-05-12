using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Obscura.Contracts.Entities;
using Obscura.Contracts.Series;
using Obscura.Contracts.Videos;
using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;
using ContractRatingCapability = Obscura.Contracts.Entities.RatingCapability;
using DomainCapabilityCredits = Obscura.Domain.Capabilities.CapabilityCredits;
using DomainCapabilityFiles = Obscura.Domain.Capabilities.CapabilityFiles;
using DomainCapabilityFlags = Obscura.Domain.Capabilities.CapabilityFlags;
using DomainCapabilityImages = Obscura.Domain.Capabilities.CapabilityImages;
using DomainCapabilityLinks = Obscura.Domain.Capabilities.CapabilityLinks;
using DomainCapabilityRating = Obscura.Domain.Capabilities.CapabilityRating;
using DomainCapabilityStudio = Obscura.Domain.Capabilities.CapabilityStudio;
using DomainCapabilityTags = Obscura.Domain.Capabilities.CapabilityTags;
using DomainEntity = Obscura.Domain.Entities.Entity;
using DomainEntityPage = Obscura.Domain.Entities.EntityPage;
using DomainMarkers = Obscura.Domain.Capabilities.Markers;
using DomainRating = Obscura.Domain.Capabilities.Rating;
using DomainSubtitles = Obscura.Domain.Capabilities.Subtitles;
using DomainVideo = Obscura.Domain.Media.Video;
using DomainVideoSeries = Obscura.Domain.Media.VideoSeries;

namespace Obscura.Api.Tests;

public sealed class EntityVideoEndpointServiceTests
{
    [Fact]
    public async Task EntityAndVideoEndpointsUseProjectionService()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();
        var id = FakeEntityProjectionService.VideoId;

        var entities = await client.GetFromJsonAsync<EntityListResponse>("/api/entities?kind=video");
        var video = await client.GetFromJsonAsync<VideoDetail>($"/api/videos/{id}");
        var ratingResponse = await client.PatchAsJsonAsync(
            $"/api/entities/{id}/rating",
            new RatingUpdateRequest(5));
        var rated = await ratingResponse.Content.ReadFromJsonAsync<EntityCard>();

        var entity = Assert.Single(entities!.Items);
        Assert.Equal(id, entity.Id);
        Assert.Equal("video", entity.Kind);
        Assert.NotNull(video);
        Assert.Equal("Projected Video", video.Title);
        var rating = Assert.Single(rated!.Capabilities.OfType<ContractRatingCapability>());
        Assert.Equal(5, rating.Value?.Value);
    }

    [Fact]
    public async Task EntityEndpointSerializesCapabilitiesAsDiscriminatedList()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();

        var json = await client.GetStringAsync("/api/entities?kind=video");
        using var document = JsonDocument.Parse(json);

        var capabilities = document.RootElement
            .GetProperty("items")[0]
            .GetProperty("capabilities");
        Assert.Equal(JsonValueKind.Array, capabilities.ValueKind);

        var rating = capabilities.EnumerateArray().Single(capability =>
            capability.GetProperty("kind").GetString() == "rating");
        var tags = capabilities.EnumerateArray().Single(capability =>
            capability.GetProperty("kind").GetString() == "tags");

        Assert.True(rating.TryGetProperty("value", out var value));
        Assert.Equal(JsonValueKind.Null, value.ValueKind);
        Assert.Equal("Demo", tags.GetProperty("values")[0].GetString());
    }

    [Fact]
    public async Task MissingProjectedVideoUsesProblemDetailsShape()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/api/videos/99999999-9999-9999-9999-999999999999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
    }

    private static WebApplicationFactory<Program> CreateFactory()
    {
        return new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    services.AddScoped<FakeEntityProjectionService>();
                    services.AddScoped<IEntityCatalog>(provider => provider.GetRequiredService<FakeEntityProjectionService>());
                    services.AddScoped<IRatingService>(provider => provider.GetRequiredService<FakeEntityProjectionService>());
                    services.AddScoped<IVideoLibrary>(provider => provider.GetRequiredService<FakeEntityProjectionService>());
                });
            });
    }

    private sealed class FakeEntityProjectionService : IEntityCatalog, IRatingService, IVideoLibrary
    {
        public static readonly Guid VideoId = Guid.Parse("11111111-1111-1111-1111-111111111111");

        public Task<DomainEntityPage> ListAsync(
            IEntityKind? kind,
            string? query,
            string? cursor,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(new DomainEntityPage([Card(null)], null));
        }

        public Task<DomainEntity?> GetAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<DomainEntity?>(id == VideoId ? Card(null) : null);
        }

        public Task<IReadOnlyList<DomainEntity>> ListChildrenAsync(
            Guid parentId,
            IEntityRelationship relationship,
            IEntityKind? childKind,
            CancellationToken cancellationToken)
        {
            return Task.FromResult<IReadOnlyList<DomainEntity>>([]);
        }

        public Task<DomainEntity?> UpdateRatingAsync(
            Guid id,
            int? value,
            CancellationToken cancellationToken)
        {
            return Task.FromResult<DomainEntity?>(id == VideoId ? Card(value) : null);
        }

        public Task<DomainEntity?> UpdateFlagsAsync(
            Guid id,
            bool? isFavorite,
            bool? isNsfw,
            bool? isOrganized,
            CancellationToken cancellationToken)
        {
            return Task.FromResult<DomainEntity?>(id == VideoId ? Card(null) : null);
        }

        public Task<DomainEntityPage> ListVideosAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(new DomainEntityPage([Card(null)], null));
        }

        public Task<DomainVideo?> GetVideoAsync(Guid id, CancellationToken cancellationToken)
        {
            if (id != VideoId)
            {
                return Task.FromResult<DomainVideo?>(null);
            }

            return Task.FromResult<DomainVideo?>(new DomainVideo(
                Card(null),
                Summary: "Detail from projection service.",
                SortTitle: null,
                OriginalTitle: null,
                Tagline: null,
                ReleaseDate: null,
                ContentRating: null,
                Duration: TimeSpan.FromMinutes(2),
                Width: 1280,
                Height: 720,
                FrameRate: null,
                BitRate: null,
                Codec: null,
                Container: null,
                LibraryRootId: null,
                SubtitlesExtractedAt: null,
                markers: DomainMarkers.Empty,
                subtitles: DomainSubtitles.Empty));
        }

        public Task<DomainEntityPage> ListSeriesAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(new DomainEntityPage([], null));
        }

        public Task<DomainVideoSeries?> GetSeriesAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<DomainVideoSeries?>(null);
        }

        private static DomainEntity Card(int? rating)
        {
            return new DomainEntity(
                VideoId,
                EntityKindRegistry.Video,
                "Projected Video",
                null,
                [
                    new DomainCapabilityRating(
                        rating is null ? null : new DomainRating(rating.Value)),
                    new DomainCapabilityTags(["Demo"]),
                    DomainCapabilityCredits.Empty,
                    new DomainCapabilityStudio(null),
                    DomainCapabilityImages.Empty,
                    DomainCapabilityLinks.Empty,
                    new DomainCapabilityFlags(false, false, true),
                    DomainCapabilityFiles.Empty
                ]);
        }
    }
}

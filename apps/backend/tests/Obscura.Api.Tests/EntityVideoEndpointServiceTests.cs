using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Obscura.Contracts.Entities;
using Obscura.Contracts.Series;
using Obscura.Contracts.Videos;
using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;
using DomainCapabilities = Obscura.Domain.Capabilities.EntityCapabilities;
using DomainCredits = Obscura.Domain.Capabilities.Credits;
using DomainEntity = Obscura.Domain.Entities.Entity;
using DomainEntityPage = Obscura.Domain.Entities.EntityPage;
using DomainFiles = Obscura.Domain.Capabilities.Files;
using DomainFlags = Obscura.Domain.Capabilities.EntityFlags;
using DomainImages = Obscura.Domain.Capabilities.Images;
using DomainLinks = Obscura.Domain.Capabilities.Links;
using DomainMarkers = Obscura.Domain.Capabilities.Markers;
using DomainRating = Obscura.Domain.Capabilities.Rating;
using DomainRatingValue = Obscura.Domain.Capabilities.RatingValue;
using DomainSubtitles = Obscura.Domain.Capabilities.Subtitles;
using DomainTags = Obscura.Domain.Capabilities.Tags;
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
        Assert.Equal(5, rated?.Capabilities.Rating?.Value);
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
            EntityKind? kind,
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
            EntityRelationship relationship,
            EntityKind? childKind,
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
                "Detail from projection service.",
                TimeSpan.FromMinutes(2),
                1280,
                720,
                DomainMarkers.Empty,
                DomainSubtitles.Empty));
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
                EntityKind.Video,
                "Projected Video",
                null,
                new DomainCapabilities(
                    rating is null ? null : new DomainRating(DomainRatingValue.Create(rating.Value)),
                    new DomainTags(["Demo"]),
                    DomainCredits.Empty,
                    null,
                    DomainImages.Empty,
                    DomainLinks.Empty,
                    new DomainFlags(false, false, true),
                    DomainFiles.Empty));
        }
    }
}

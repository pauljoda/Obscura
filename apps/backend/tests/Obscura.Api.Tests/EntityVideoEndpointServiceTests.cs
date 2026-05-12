using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Obscura.Contracts.Entities;
using Obscura.Contracts.Series;
using Obscura.Contracts.Videos;
using Obscura.Application.Entities;

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
                    services.AddScoped<IEntityCatalog, FakeEntityProjectionService>();
                });
            });
    }

    private sealed class FakeEntityProjectionService : IEntityCatalog
    {
        public static readonly Guid VideoId = Guid.Parse("11111111-1111-1111-1111-111111111111");

        public Task<EntityListResponse> ListAsync(
            string? kind,
            string? query,
            string? cursor,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(new EntityListResponse([Card(null)], null));
        }

        public Task<EntityCard?> GetCardAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult(id == VideoId ? Card(null) : null);
        }

        public Task<IReadOnlyList<EntityCard>> ListChildrenAsync(
            Guid parentId,
            string relationship,
            string? childKind,
            CancellationToken cancellationToken)
        {
            return Task.FromResult<IReadOnlyList<EntityCard>>([]);
        }

        public Task<EntityCard?> UpdateRatingAsync(
            Guid id,
            RatingUpdateRequest request,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(id == VideoId ? Card(request.Value) : null);
        }

        public Task<EntityCard?> UpdateFlagsAsync(
            Guid id,
            EntityFlagsUpdateRequest request,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(id == VideoId ? Card(null) : null);
        }

        public Task<VideoListResponse> ListVideosAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(new VideoListResponse([Card(null)], null));
        }

        public Task<VideoDetail?> GetVideoAsync(Guid id, CancellationToken cancellationToken)
        {
            if (id != VideoId)
            {
                return Task.FromResult<VideoDetail?>(null);
            }

            return Task.FromResult<VideoDetail?>(new VideoDetail(
                VideoId,
                "video",
                "Projected Video",
                "Detail from projection service.",
                TimeSpan.FromMinutes(2),
                1280,
                720,
                [],
                [],
                Card(null).Capabilities));
        }

        public Task<VideoSeriesListResponse> ListSeriesAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(new VideoSeriesListResponse([], null));
        }

        public Task<VideoSeriesDetail?> GetSeriesAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<VideoSeriesDetail?>(null);
        }

        private static EntityCard Card(int? rating)
        {
            return new EntityCard(
                VideoId,
                "video",
                "Projected Video",
                null,
                new EntityCapabilities(
                    rating is null ? null : new Rating(rating),
                    ["Demo"],
                    [],
                    null,
                    [],
                    [],
                    null,
                    null,
                    false,
                    false,
                    true));
        }
    }
}

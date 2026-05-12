using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Obscura.Contracts.Entities;
using Obscura.Contracts.Series;
using Obscura.Contracts.Videos;
using Obscura.Infrastructure.Entities;

namespace Obscura.Api.Tests;

public sealed class EntityVideoEndpointServiceTests
{
    [Fact]
    public async Task EntityAndVideoEndpointsUseProjectionService()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();
        var id = FakeEntityProjectionService.VideoId;

        var entities = await client.GetFromJsonAsync<EntityListResponseDto>("/api/entities?kind=video");
        var video = await client.GetFromJsonAsync<VideoDetailDto>($"/api/videos/{id}");
        var ratingResponse = await client.PatchAsJsonAsync(
            $"/api/entities/{id}/rating",
            new RatingUpdateRequestDto(5));
        var rated = await ratingResponse.Content.ReadFromJsonAsync<EntityCardDto>();

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
                    services.AddScoped<IEntityProjectionService, FakeEntityProjectionService>();
                });
            });
    }

    private sealed class FakeEntityProjectionService : IEntityProjectionService
    {
        public static readonly Guid VideoId = Guid.Parse("11111111-1111-1111-1111-111111111111");

        public Task<EntityListResponseDto> ListAsync(
            string? kind,
            string? query,
            string? cursor,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(new EntityListResponseDto([Card(null)], null));
        }

        public Task<EntityCardDto?> GetCardAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult(id == VideoId ? Card(null) : null);
        }

        public Task<IReadOnlyList<EntityCardDto>> ListChildrenAsync(
            Guid parentId,
            string relationship,
            CancellationToken cancellationToken)
        {
            return Task.FromResult<IReadOnlyList<EntityCardDto>>([]);
        }

        public Task<EntityCardDto?> UpdateRatingAsync(
            Guid id,
            RatingUpdateRequestDto request,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(id == VideoId ? Card(request.Value) : null);
        }

        public Task<EntityCardDto?> UpdateFlagsAsync(
            Guid id,
            EntityFlagsUpdateRequestDto request,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(id == VideoId ? Card(null) : null);
        }

        public Task<VideoListResponseDto> ListVideosAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(new VideoListResponseDto([Card(null)], null));
        }

        public Task<VideoDetailDto?> GetVideoAsync(Guid id, CancellationToken cancellationToken)
        {
            if (id != VideoId)
            {
                return Task.FromResult<VideoDetailDto?>(null);
            }

            return Task.FromResult<VideoDetailDto?>(new VideoDetailDto(
                VideoId,
                "video",
                "Projected Video",
                "Detail from projection service.",
                TimeSpan.FromMinutes(2),
                1280,
                720,
                Card(null).Capabilities));
        }

        public Task<VideoSeriesListResponseDto> ListSeriesAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(new VideoSeriesListResponseDto([], null));
        }

        public Task<VideoSeriesDetailDto?> GetSeriesAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<VideoSeriesDetailDto?>(null);
        }

        private static EntityCardDto Card(int? rating)
        {
            return new EntityCardDto(
                VideoId,
                "video",
                "Projected Video",
                null,
                new EntityCapabilitiesDto(
                    rating is null ? null : new RatingDto(rating),
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

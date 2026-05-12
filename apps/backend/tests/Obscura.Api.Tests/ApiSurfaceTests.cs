using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Obscura.Contracts.Collections;
using Obscura.Contracts.Entities;
using Obscura.Contracts.Jobs;
using Obscura.Contracts.Media;
using Obscura.Contracts.Series;
using Obscura.Contracts.Settings;
using Obscura.Contracts.Taxonomy;
using Obscura.Contracts.Videos;
using Obscura.Application.Entities;
using Obscura.Infrastructure.Queue;
using Obscura.Infrastructure.Settings;

namespace Obscura.Api.Tests;

public sealed class ApiSurfaceTests
{
    private readonly WebApplicationFactory<Program> _factory;

    public ApiSurfaceTests()
    {
        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    services.AddScoped<IEntityCatalog, EmptyEntityProjectionService>();
                    services.AddScoped<IJobQueueService, EmptyJobQueueService>();
                    services.AddScoped<ISettingsService, DefaultSettingsService>();
                });
            });
    }

    [Fact]
    public async Task EntityListEndpointReturnsAStablePagedShape()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetFromJsonAsync<EntityListResponse>("/api/entities?kind=video");

        Assert.NotNull(response);
        Assert.Empty(response.Items);
        Assert.Null(response.NextCursor);
    }

    [Fact]
    public async Task VideoListEndpointReturnsAStablePagedShape()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetFromJsonAsync<VideoListResponse>("/api/videos");

        Assert.NotNull(response);
        Assert.Empty(response.Items);
        Assert.Null(response.NextCursor);
    }

    [Fact]
    public async Task SeriesListEndpointReturnsAStablePagedShape()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetFromJsonAsync<VideoSeriesListResponse>("/api/series");

        Assert.NotNull(response);
        Assert.Empty(response.Items);
        Assert.Null(response.NextCursor);
    }

    [Fact]
    public async Task CollectionListEndpointReturnsAStablePagedShape()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetFromJsonAsync<CollectionListResponse>("/api/collections");

        Assert.NotNull(response);
        Assert.Empty(response.Items);
        Assert.Null(response.NextCursor);
    }

    [Theory]
    [InlineData("/api/performers")]
    [InlineData("/api/studios")]
    [InlineData("/api/tags")]
    public async Task TaxonomyListEndpointsReturnStablePagedShapes(string path)
    {
        using var client = _factory.CreateClient();

        var response = await client.GetFromJsonAsync<TaxonomyListResponse>(path);

        Assert.NotNull(response);
        Assert.Empty(response.Items);
        Assert.Null(response.NextCursor);
    }

    [Theory]
    [InlineData("/api/images")]
    [InlineData("/api/galleries")]
    [InlineData("/api/books")]
    [InlineData("/api/audio-libraries")]
    [InlineData("/api/audio-tracks")]
    public async Task MediaListEndpointsReturnStablePagedShapes(string path)
    {
        using var client = _factory.CreateClient();

        var response = await client.GetFromJsonAsync<MediaListResponse>(path);

        Assert.NotNull(response);
        Assert.Empty(response.Items);
        Assert.Null(response.NextCursor);
    }

    [Fact]
    public async Task JobsEndpointReturnsAnOperationsDashboardShape()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetFromJsonAsync<JobListResponse>("/api/jobs");

        Assert.NotNull(response);
        Assert.Empty(response.Items);
    }

    [Fact]
    public async Task SettingsEndpointReturnsRuntimeDefaults()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetFromJsonAsync<SettingsResponse>("/api/settings");

        Assert.NotNull(response);
        Assert.False(response.HideNsfw);
        Assert.True(response.EnableCastControls);
    }

    [Fact]
    public async Task MissingEntityDetailUsesProblemDetailsShape()
    {
        using var client = _factory.CreateClient();
        var id = Guid.Parse("11111111-1111-1111-1111-111111111111");

        using var response = await client.GetAsync($"/api/entities/{id}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
    }

    private sealed class EmptyJobQueueService : IJobQueueService
    {
        public Task<IReadOnlyList<JobRun>> ListAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult<IReadOnlyList<JobRun>>([]);
        }

        public Task<JobRun> EnqueueAsync(string type, CancellationToken cancellationToken)
        {
            throw new NotSupportedException("The API surface smoke test does not create jobs.");
        }

        public Task<JobRun?> ClaimNextAsync(string workerId, CancellationToken cancellationToken)
        {
            throw new NotSupportedException("The API surface smoke test does not claim jobs.");
        }

        public Task CompleteAsync(Guid id, string? message, CancellationToken cancellationToken)
        {
            throw new NotSupportedException("The API surface smoke test does not complete jobs.");
        }

        public Task FailAsync(
            Guid id,
            string message,
            TimeSpan retryDelay,
            CancellationToken cancellationToken)
        {
            throw new NotSupportedException("The API surface smoke test does not fail jobs.");
        }
    }

    private sealed class EmptyEntityProjectionService : IEntityCatalog
    {
        public Task<EntityListResponse> ListAsync(
            string? kind,
            string? query,
            string? cursor,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(new EntityListResponse([], null));
        }

        public Task<EntityCard?> GetCardAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<EntityCard?>(null);
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
            return Task.FromResult<EntityCard?>(null);
        }

        public Task<EntityCard?> UpdateFlagsAsync(
            Guid id,
            EntityFlagsUpdateRequest request,
            CancellationToken cancellationToken)
        {
            return Task.FromResult<EntityCard?>(null);
        }

        public Task<VideoListResponse> ListVideosAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(new VideoListResponse([], null));
        }

        public Task<VideoDetail?> GetVideoAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<VideoDetail?>(null);
        }

        public Task<VideoSeriesListResponse> ListSeriesAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(new VideoSeriesListResponse([], null));
        }

        public Task<VideoSeriesDetail?> GetSeriesAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<VideoSeriesDetail?>(null);
        }
    }

    private sealed class DefaultSettingsService : ISettingsService
    {
        public Task<SettingsResponse> GetAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(new SettingsResponse(false, true));
        }

        public Task<SettingsResponse> UpdateAsync(SettingsUpdateRequest request, CancellationToken cancellationToken)
        {
            return Task.FromResult(new SettingsResponse(
                request.HideNsfw ?? false,
                request.EnableCastControls ?? true));
        }
    }
}

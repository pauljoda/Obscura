using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Obscura.Contracts.Entities;
using Obscura.Contracts.Jobs;
using Obscura.Contracts.Settings;
using Obscura.Contracts.Videos;
using Obscura.Infrastructure.Entities;
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
                    services.AddScoped<IEntityProjectionService, EmptyEntityProjectionService>();
                    services.AddScoped<IJobQueueService, EmptyJobQueueService>();
                    services.AddScoped<ISettingsService, DefaultSettingsService>();
                });
            });
    }

    [Fact]
    public async Task EntityListEndpointReturnsAStablePagedShape()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetFromJsonAsync<EntityListResponseDto>("/api/entities?kind=video");

        Assert.NotNull(response);
        Assert.Empty(response.Items);
        Assert.Null(response.NextCursor);
    }

    [Fact]
    public async Task VideoListEndpointReturnsAStablePagedShape()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetFromJsonAsync<VideoListResponseDto>("/api/videos");

        Assert.NotNull(response);
        Assert.Empty(response.Items);
        Assert.Null(response.NextCursor);
    }

    [Fact]
    public async Task JobsEndpointReturnsAnOperationsDashboardShape()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetFromJsonAsync<JobListResponseDto>("/api/jobs");

        Assert.NotNull(response);
        Assert.Empty(response.Items);
    }

    [Fact]
    public async Task SettingsEndpointReturnsRuntimeDefaults()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetFromJsonAsync<SettingsDto>("/api/settings");

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
        public Task<IReadOnlyList<JobRunDto>> ListAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult<IReadOnlyList<JobRunDto>>([]);
        }

        public Task<JobRunDto> EnqueueAsync(string type, CancellationToken cancellationToken)
        {
            throw new NotSupportedException("The API surface smoke test does not create jobs.");
        }
    }

    private sealed class EmptyEntityProjectionService : IEntityProjectionService
    {
        public Task<EntityListResponseDto> ListAsync(
            string? kind,
            string? query,
            string? cursor,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(new EntityListResponseDto([], null));
        }

        public Task<EntityCardDto?> GetCardAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<EntityCardDto?>(null);
        }

        public Task<EntityCardDto?> UpdateRatingAsync(
            Guid id,
            RatingUpdateRequestDto request,
            CancellationToken cancellationToken)
        {
            return Task.FromResult<EntityCardDto?>(null);
        }

        public Task<EntityCardDto?> UpdateFlagsAsync(
            Guid id,
            EntityFlagsUpdateRequestDto request,
            CancellationToken cancellationToken)
        {
            return Task.FromResult<EntityCardDto?>(null);
        }

        public Task<VideoListResponseDto> ListVideosAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(new VideoListResponseDto([], null));
        }

        public Task<VideoDetailDto?> GetVideoAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<VideoDetailDto?>(null);
        }
    }

    private sealed class DefaultSettingsService : ISettingsService
    {
        public Task<SettingsDto> GetAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(new SettingsDto(false, true));
        }

        public Task<SettingsDto> UpdateAsync(SettingsUpdateRequestDto request, CancellationToken cancellationToken)
        {
            return Task.FromResult(new SettingsDto(
                request.HideNsfw ?? false,
                request.EnableCastControls ?? true));
        }
    }
}

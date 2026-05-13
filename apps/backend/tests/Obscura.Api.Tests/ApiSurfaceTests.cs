using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Obscura.Application.Jobs;
using Obscura.Application.Settings;
using Obscura.Contracts.Collections;
using Obscura.Contracts.Entities;
using Obscura.Contracts.Jobs;
using Obscura.Contracts.Media;
using Obscura.Contracts.Series;
using Obscura.Contracts.Settings;
using Obscura.Contracts.Taxonomy;
using Obscura.Contracts.Videos;
using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;
using DomainEntity = Obscura.Domain.Entities.Entity;
using DomainEntityPage = Obscura.Domain.Entities.EntityPage;
using DomainAudioLibrary = Obscura.Domain.Media.AudioLibrary;
using DomainAudioTrack = Obscura.Domain.Media.AudioTrack;
using DomainBook = Obscura.Domain.Media.Book;
using DomainCollection = Obscura.Domain.Media.Collection;
using DomainGallery = Obscura.Domain.Media.Gallery;
using DomainImage = Obscura.Domain.Media.Image;
using DomainPerson = Obscura.Domain.Taxonomy.Person;
using DomainStudio = Obscura.Domain.Taxonomy.Studio;
using DomainTag = Obscura.Domain.Taxonomy.Tag;
using DomainVideo = Obscura.Domain.Media.Video;
using DomainVideoSeries = Obscura.Domain.Media.VideoSeries;

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
                    services.AddScoped<EmptyEntityProjectionService>();
                    services.AddScoped<IEntityCatalog>(provider => provider.GetRequiredService<EmptyEntityProjectionService>());
                    services.AddScoped<IEntityDetails>(provider => provider.GetRequiredService<EmptyEntityProjectionService>());
                    services.AddScoped<IRatingService>(provider => provider.GetRequiredService<EmptyEntityProjectionService>());
                    services.AddScoped<IVideoLibrary>(provider => provider.GetRequiredService<EmptyEntityProjectionService>());
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
    public async Task EntityListEndpointRejectsUnknownKinds()
    {
        using var client = _factory.CreateClient();

        using var response = await client.GetAsync("/api/entities?kind=surprise");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
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
    [InlineData("/api/people")]
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
        public Task<IReadOnlyList<JobRunSnapshot>> ListAsync(CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<JobRunSnapshot>>([]);

        public Task<JobRunSnapshot> EnqueueAsync(JobType type, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<JobRunSnapshot> EnqueueAsync(EnqueueJobRequest request, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<bool> HasPendingAsync(JobType type, string? targetEntityId, CancellationToken cancellationToken) =>
            Task.FromResult(false);

        public Task<int> CancelAsync(JobType? type, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<bool> CancelRunAsync(Guid id, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<int> ClearFailuresAsync(JobType? type, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<JobRunSnapshot?> ClaimNextAsync(string workerId, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task UpdateProgressAsync(Guid id, int progress, string? message, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task CompleteAsync(Guid id, string? message, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task FailAsync(Guid id, string message, TimeSpan retryDelay, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<int> PruneHistoryAsync(TimeSpan retention, CancellationToken cancellationToken) =>
            throw new NotSupportedException();
    }

    private sealed class EmptyEntityProjectionService : IEntityCatalog, IEntityDetails, IRatingService, IVideoLibrary
    {
        public Task<DomainEntityPage> ListAsync(
            IEntityKind? kind,
            string? query,
            string? cursor,
            bool hideNsfw,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(new DomainEntityPage([], null));
        }

        public Task<DomainEntity?> GetAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<DomainEntity?>(null);
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
            return Task.FromResult<DomainEntity?>(null);
        }

        public Task<DomainEntity?> UpdateFlagsAsync(
            Guid id,
            bool? isFavorite,
            bool? isNsfw,
            bool? isOrganized,
            CancellationToken cancellationToken)
        {
            return Task.FromResult<DomainEntity?>(null);
        }

        public Task<DomainEntityPage> ListVideosAsync(bool hideNsfw, CancellationToken cancellationToken)
        {
            return Task.FromResult(new DomainEntityPage([], null));
        }

        public Task<DomainVideo?> GetVideoAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<DomainVideo?>(null);
        }

        public Task<DomainEntityPage> ListSeriesAsync(bool hideNsfw, CancellationToken cancellationToken)
        {
            return Task.FromResult(new DomainEntityPage([], null));
        }

        public Task<DomainVideoSeries?> GetSeriesAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<DomainVideoSeries?>(null);
        }

        public Task<DomainImage?> GetImageAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<DomainImage?>(null);
        }

        public Task<DomainGallery?> GetGalleryAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<DomainGallery?>(null);
        }

        public Task<DomainBook?> GetBookAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<DomainBook?>(null);
        }

        public Task<DomainAudioLibrary?> GetAudioLibraryAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<DomainAudioLibrary?>(null);
        }

        public Task<DomainAudioTrack?> GetAudioTrackAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<DomainAudioTrack?>(null);
        }

        public Task<DomainPerson?> GetPersonAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<DomainPerson?>(null);
        }

        public Task<DomainStudio?> GetStudioAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<DomainStudio?>(null);
        }

        public Task<DomainTag?> GetTagAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<DomainTag?>(null);
        }

        public Task<DomainCollection?> GetCollectionAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<DomainCollection?>(null);
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

        public Task<LibraryConfigResponse> GetLibraryConfigAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(new LibraryConfigResponse(SampleSettings(), []));
        }

        public Task<LibrarySettings> UpdateLibrarySettingsAsync(
            LibrarySettingsUpdateRequest request,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(SampleSettings());
        }

        public Task<LibraryBrowseResponse> BrowseLibraryPathAsync(
            string? path,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(new LibraryBrowseResponse(path ?? "/media", "/", []));
        }

        public Task<LibraryRoot> CreateLibraryRootAsync(
            LibraryRootCreateRequest request,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(new LibraryRoot(
                Guid.NewGuid(),
                request.Path,
                request.Label ?? "Media",
                true,
                true,
                true,
                true,
                true,
                false,
                false,
                null,
                DateTimeOffset.UnixEpoch,
                DateTimeOffset.UnixEpoch));
        }

        public Task<LibraryRoot?> UpdateLibraryRootAsync(
            Guid id,
            LibraryRootUpdateRequest request,
            CancellationToken cancellationToken)
        {
            return Task.FromResult<LibraryRoot?>(null);
        }

        public Task<bool> DeleteLibraryRootAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult(false);
        }

        private static LibrarySettings SampleSettings()
        {
            return new LibrarySettings(
                Guid.NewGuid(),
                false,
                60,
                true,
                true,
                false,
                true,
                true,
                10,
                8,
                2,
                2,
                1,
                false,
                true,
                false,
                "en,eng",
                "stylized",
                1,
                88,
                1,
                "direct",
                true,
                DateTimeOffset.UnixEpoch,
                DateTimeOffset.UnixEpoch);
        }
    }
}

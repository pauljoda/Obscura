using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Obscura.Application.Settings;
using Obscura.Contracts.Entities;
using Obscura.Contracts.Settings;
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
using DomainCapabilityDescription = Obscura.Domain.Capabilities.CapabilityDescription;
using DomainCapabilityTechnical = Obscura.Domain.Capabilities.CapabilityTechnical;
using DomainEntity = Obscura.Domain.Entities.Entity;
using DomainEntityPage = Obscura.Domain.Entities.EntityPage;
using DomainCollection = Obscura.Domain.Media.Collection;
using DomainGallery = Obscura.Domain.Media.Gallery;
using DomainTag = Obscura.Domain.Taxonomy.Tag;
using DomainRating = Obscura.Domain.Capabilities.Rating;
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
    public async Task EntityListEndpointUsesServerHideNsfwSetting()
    {
        using var factory = CreateFactory(hideNsfw: true);
        using var client = factory.CreateClient();

        var entities = await client.GetFromJsonAsync<EntityListResponse>("/api/entities?kind=video");

        Assert.NotNull(entities);
        Assert.Empty(entities.Items);
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

    private static WebApplicationFactory<Program> CreateFactory(bool hideNsfw = false)
    {
        return new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    services.AddScoped<FakeEntityProjectionService>();
                    services.AddScoped<IEntityCatalog>(provider => provider.GetRequiredService<FakeEntityProjectionService>());
                    services.AddScoped<IEntityDetails>(provider => provider.GetRequiredService<FakeEntityProjectionService>());
                    services.AddScoped<IRatingService>(provider => provider.GetRequiredService<FakeEntityProjectionService>());
                    services.AddScoped<IVideoLibrary>(provider => provider.GetRequiredService<FakeEntityProjectionService>());
                    services.AddSingleton<ISettingsService>(new FakeSettingsService(hideNsfw));
                });
            });
    }

    [Fact]
    public async Task DetailEndpointsUseTypedAggregateHydrators()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();

        var galleryJson = await client.GetStringAsync($"/api/galleries/{FakeEntityProjectionService.GalleryId}");
        var tagJson = await client.GetStringAsync($"/api/tags/{FakeEntityProjectionService.TagId}");
        var collectionJson = await client.GetStringAsync($"/api/collections/{FakeEntityProjectionService.CollectionId}");

        using var gallery = JsonDocument.Parse(galleryJson);
        using var tag = JsonDocument.Parse(tagJson);
        using var collection = JsonDocument.Parse(collectionJson);

        Assert.Equal("folder", gallery.RootElement.GetProperty("galleryType").GetString());
        Assert.True(tag.RootElement.GetProperty("ignoreAutoTag").GetBoolean());
        Assert.Equal("dynamic", collection.RootElement.GetProperty("mode").GetString());
    }

    private sealed class FakeEntityProjectionService : IEntityCatalog, IEntityDetails, IRatingService, IVideoLibrary
    {
        public static readonly Guid VideoId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        public static readonly Guid GalleryId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        public static readonly Guid TagId = Guid.Parse("33333333-3333-3333-3333-333333333333");
        public static readonly Guid CollectionId = Guid.Parse("44444444-4444-4444-4444-444444444444");

        public Task<DomainEntityPage> ListAsync(
            IEntityKind? kind,
            string? query,
            string? cursor,
            bool hideNsfw,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(new DomainEntityPage(hideNsfw ? [] : [Card(null)], null));
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

        public Task<DomainEntityPage> ListVideosAsync(bool hideNsfw, CancellationToken cancellationToken)
        {
            return Task.FromResult(new DomainEntityPage(hideNsfw ? [] : [Card(null)], null));
        }

        public Task<DomainVideo?> GetVideoAsync(Guid id, CancellationToken cancellationToken)
        {
            if (id != VideoId)
            {
                return Task.FromResult<DomainVideo?>(null);
            }

            return Task.FromResult<DomainVideo?>(new DomainVideo(
                Card(null)
                    .WithCapability(
                        Obscura.Domain.Capabilities.CapabilityRegistry.Description,
                        new DomainCapabilityDescription("Detail from projection service."))
                    .WithCapability(
                        Obscura.Domain.Capabilities.CapabilityRegistry.Technical,
                        new DomainCapabilityTechnical(Duration: TimeSpan.FromMinutes(2), Width: 1280, Height: 720)),
                SubtitlesExtractedAt: null));
        }

        public Task<DomainEntityPage> ListSeriesAsync(bool hideNsfw, CancellationToken cancellationToken)
        {
            return Task.FromResult(new DomainEntityPage([], null));
        }

        public Task<DomainVideoSeries?> GetSeriesAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<DomainVideoSeries?>(null);
        }

        public Task<Obscura.Domain.Media.Image?> GetImageAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<Obscura.Domain.Media.Image?>(null);
        }

        public Task<DomainGallery?> GetGalleryAsync(Guid id, CancellationToken cancellationToken)
        {
            if (id != GalleryId)
            {
                return Task.FromResult<DomainGallery?>(null);
            }

            return Task.FromResult<DomainGallery?>(new DomainGallery(
                GalleryCard(),
                GalleryType.Folder,
                CoverImageId: null));
        }

        public Task<Obscura.Domain.Media.Book?> GetBookAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<Obscura.Domain.Media.Book?>(null);
        }

        public Task<Obscura.Domain.Media.AudioLibrary?> GetAudioLibraryAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<Obscura.Domain.Media.AudioLibrary?>(null);
        }

        public Task<Obscura.Domain.Media.AudioTrack?> GetAudioTrackAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<Obscura.Domain.Media.AudioTrack?>(null);
        }

        public Task<Obscura.Domain.Taxonomy.Person?> GetPersonAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<Obscura.Domain.Taxonomy.Person?>(null);
        }

        public Task<Obscura.Domain.Taxonomy.Studio?> GetStudioAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult<Obscura.Domain.Taxonomy.Studio?>(null);
        }

        public Task<DomainTag?> GetTagAsync(Guid id, CancellationToken cancellationToken)
        {
            if (id != TagId)
            {
                return Task.FromResult<DomainTag?>(null);
            }

            return Task.FromResult<DomainTag?>(new DomainTag(
                TagCard(),
                ParentTagId: null,
                IgnoreAutoTag: true));
        }

        public Task<DomainCollection?> GetCollectionAsync(Guid id, CancellationToken cancellationToken)
        {
            if (id != CollectionId)
            {
                return Task.FromResult<DomainCollection?>(null);
            }

            return Task.FromResult<DomainCollection?>(new DomainCollection(
                CollectionCard(),
                CollectionMode.Dynamic,
                RuleTreeJson: null,
                CollectionCoverMode.Mosaic,
                CoverItemId: null,
                TimeSpan.FromSeconds(5),
                SlideshowAutoAdvance: true,
                LastRefreshedAt: null,
                items: []));
        }

        private static DomainEntity Card(int? rating)
        {
            return new DomainEntity(
                VideoId,
                EntityKindRegistry.Video,
                "Projected Video",
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

        private static DomainEntity GalleryCard() =>
            new(
                GalleryId,
                EntityKindRegistry.Gallery,
                "Projected Gallery",
                []);

        private static DomainEntity TagCard() =>
            new(
                TagId,
                EntityKindRegistry.Tag,
                "Projected Tag",
                []);

        private static DomainEntity CollectionCard() =>
            new(
                CollectionId,
                EntityKindRegistry.Collection,
                "Projected Collection",
                []);
    }

    private sealed class FakeSettingsService : ISettingsService
    {
        private readonly bool _hideNsfw;

        public FakeSettingsService(bool hideNsfw)
        {
            _hideNsfw = hideNsfw;
        }

        public Task<SettingsResponse> GetAsync(CancellationToken cancellationToken) =>
            Task.FromResult(new SettingsResponse(_hideNsfw, EnableCastControls: true));

        public Task<SettingsResponse> UpdateAsync(SettingsUpdateRequest request, CancellationToken cancellationToken) =>
            GetAsync(cancellationToken);
    }
}

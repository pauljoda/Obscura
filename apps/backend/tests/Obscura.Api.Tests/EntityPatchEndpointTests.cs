using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Obscura.Application.Entities;
using Obscura.Contracts.Entities;
using Obscura.Contracts.Plugins;

namespace Obscura.Api.Tests;

public sealed class EntityPatchEndpointTests {
    private static readonly Guid EntityId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    [Fact]
    public async Task KindGuardedEntityPatchAppliesMetadataAndReturnsUpdatedCard() {
        using var factory = CreateFactory(EntityMetadataPatchResult.Applied);
        using var client = factory.CreateClient();

        using var response = await client.PatchAsJsonAsync(
            $"/api/entities/video/{EntityId}",
            Request("Updated Title"));
        var card = await response.Content.ReadFromJsonAsync<EntityCard>();
        var patcher = factory.Services.GetRequiredService<FakeEntityMetadataPatchService>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(card);
        Assert.Equal("Video Title", card.Title);
        Assert.Equal(EntityId, patcher.EntityId);
        Assert.Equal("video", patcher.ExpectedKind);
    }

    [Fact]
    public async Task KindGuardedEntityPatchReturnsNotFoundForKindMismatch() {
        using var factory = CreateFactory(EntityMetadataPatchResult.KindMismatch);
        using var client = factory.CreateClient();

        using var response = await client.PatchAsJsonAsync(
            $"/api/entities/video-series/{EntityId}",
            Request("Wrong Kind"));
        var patcher = factory.Services.GetRequiredService<FakeEntityMetadataPatchService>();

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("video-series", patcher.ExpectedKind);
    }

    [Fact]
    public async Task DomainEntityPatchRoutesDelegateWithDomainKind() {
        using var factory = CreateFactory(EntityMetadataPatchResult.Applied);
        using var client = factory.CreateClient();

        using var response = await client.PatchAsJsonAsync(
            $"/api/videos/{EntityId}",
            Request("Video Title"));
        var patcher = factory.Services.GetRequiredService<FakeEntityMetadataPatchService>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("video", patcher.ExpectedKind);
    }

    private static EntityMetadataUpdateRequest Request(string title) =>
        new(
            ["title"],
            EmptyPatch() with { Title = title });

    private static EntityMetadataPatch EmptyPatch() => new(
        Title: null,
        Description: null,
        ExternalIds: new Dictionary<string, string>(),
        Urls: [],
        Tags: [],
        Studio: null,
        Credits: [],
        Dates: new Dictionary<string, string>(),
        Stats: new Dictionary<string, int>(),
        Positions: new Dictionary<string, int>(),
        Classification: null);

    private static WebApplicationFactory<Program> CreateFactory(EntityMetadataPatchResult result) =>
        new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder => {
                builder.ConfigureServices(services => {
                    services.AddSingleton(new FakeEntityMetadataPatchService(result));
                    services.AddScoped<IEntityMetadataPatchService>(provider =>
                        provider.GetRequiredService<FakeEntityMetadataPatchService>());
                    services.AddScoped<IEntityReadService, FakeEntityReadService>();
                });
            });

    private sealed class FakeEntityMetadataPatchService(EntityMetadataPatchResult result) : IEntityMetadataPatchService {
        public Guid? EntityId { get; private set; }
        public string? ExpectedKind { get; private set; }

        public Task<EntityMetadataPatchResult> ApplyPatchAsync(
            Guid entityId,
            EntityMetadataUpdateRequest request,
            string? expectedKind,
            CancellationToken cancellationToken) {
            EntityId = entityId;
            ExpectedKind = expectedKind;
            return Task.FromResult(result);
        }
    }

    private sealed class FakeEntityReadService : IEntityReadService {
        public Task<EntityListResponse> ListAsync(
            string? kind,
            string? query,
            string? cursor,
            bool? hideNsfw,
            int? limit,
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<EntityCard?> GetAsync(Guid id, CancellationToken cancellationToken) =>
            Task.FromResult<EntityCard?>(Card(id, "video", "Updated Title"));

        public Task<EntityThumbnailBatchResponse> GetThumbnailsAsync(
            IReadOnlyList<Guid> ids,
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<IEntityCard?> GetDetailAsync(Guid id, string kind, CancellationToken cancellationToken) =>
            Task.FromResult<IEntityCard?>(Card(id, kind, kind == "video" ? "Video Title" : "Updated Title"));

        private static EntityCard Card(Guid id, string kind, string title) =>
            new() {
                Id = id,
                Kind = kind,
                Title = title,
                ParentEntityId = null,
                SortOrder = null,
                Capabilities = [],
                ChildrenByKind = [],
                Relationships = []
            };
    }
}

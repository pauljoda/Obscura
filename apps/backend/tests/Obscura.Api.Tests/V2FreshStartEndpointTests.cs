using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Obscura.Application.Migrations;
using Obscura.Contracts.System;

namespace Obscura.Api.Tests;

public sealed class V2FreshStartEndpointTests
{
    [Fact]
    public async Task PrepareEndpointRunsFreshStartAndImportsLegacyData()
    {
        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    services.AddSingleton<IV2UpgradeGate, AcceptedGate>();
                    services.AddSingleton<IV2FreshStartService, FakeFreshStartService>();
                    services.AddSingleton<ILegacyVideoImportService, FakeLegacyVideoImportService>();
                    services.AddSingleton<ILegacyMediaImportService, FakeLegacyMediaImportService>();
                });
            });
        using var client = factory.CreateClient();

        using var response = await client.PostAsync("/api/system/v2-fresh-start/prepare", null);
        var payload = await response.Content.ReadFromJsonAsync<V2FreshStartPrepareResponse>();

        Assert.True(response.IsSuccessStatusCode);
        Assert.NotNull(payload);
        Assert.Equal("/data/backups/obscura-pre-v2.dump", payload.BackupPath);
        Assert.Equal(2, payload.PreservedLibraryRoots);
        Assert.True(payload.PreservedSettings);
        Assert.NotNull(payload.VideoImport);
        Assert.Equal(12, payload.VideoImport.VideosImported);
        Assert.Equal(3, payload.VideoImport.SeriesImported);
        Assert.NotNull(payload.MediaImport);
        Assert.Equal(10, payload.MediaImport.ImagesImported);
        Assert.Equal(3, payload.MediaImport.GalleriesImported);
    }

    [Fact]
    public async Task PrepareEndpointIsIdempotentAfterFreshStartCompletes()
    {
        var freshStart = new FakeFreshStartService();
        var videoImport = new FakeLegacyVideoImportService();
        var mediaImport = new FakeLegacyMediaImportService();

        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    services.AddSingleton<IV2UpgradeGate, AcceptedGate>();
                    services.AddSingleton<IV2FreshStartService>(freshStart);
                    services.AddSingleton<ILegacyVideoImportService>(videoImport);
                    services.AddSingleton<ILegacyMediaImportService>(mediaImport);
                });
            });
        using var client = factory.CreateClient();

        using var first = await client.PostAsync("/api/system/v2-fresh-start/prepare", null);
        using var second = await client.PostAsync("/api/system/v2-fresh-start/prepare", null);

        Assert.True(first.IsSuccessStatusCode);
        Assert.True(second.IsSuccessStatusCode);
        Assert.Equal(1, freshStart.PrepareCalls);
        Assert.Equal(1, videoImport.ImportCalls);
        Assert.Equal(1, mediaImport.ImportCalls);
    }

    [Fact]
    public async Task PromptEndpointRearmsGateWithoutResettingV2Data()
    {
        var freshStart = new FakeFreshStartService();

        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    services.AddSingleton<IV2UpgradeGate, AcceptedGate>();
                    services.AddSingleton<IV2FreshStartService>(freshStart);
                });
            });
        using var client = factory.CreateClient();

        using var response = await client.PostAsync("/api/system/v2-upgrade-gate/prompt", null);

        Assert.True(response.IsSuccessStatusCode);
        Assert.Equal(0, freshStart.ResetCalls);
        Assert.Equal(1, freshStart.ClearPreparedCalls);
    }

    [Fact]
    public async Task LegacyVideoImportEndpointReturnsImportCounts()
    {
        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    services.AddSingleton<ILegacyVideoImportService, FakeLegacyVideoImportService>();
                });
            });
        using var client = factory.CreateClient();

        using var response = await client.PostAsync("/api/system/v2-legacy-video-import", null);
        var payload = await response.Content.ReadFromJsonAsync<LegacyVideoImportResponse>();

        Assert.True(response.IsSuccessStatusCode);
        Assert.NotNull(payload);
        Assert.Equal(3, payload.SeriesImported);
        Assert.Equal(12, payload.VideosImported);
        Assert.Equal(6, payload.PeopleImported);
        Assert.Equal(4, payload.TagsImported);
        Assert.Equal(2, payload.StudiosImported);
        Assert.Equal(9, payload.LinksImported);
    }

    [Fact]
    public async Task LegacyMediaImportEndpointReturnsImportCounts()
    {
        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    services.AddSingleton<ILegacyMediaImportService, FakeLegacyMediaImportService>();
                });
            });
        using var client = factory.CreateClient();

        using var response = await client.PostAsync("/api/system/v2-legacy-media-import", null);
        var payload = await response.Content.ReadFromJsonAsync<LegacyMediaImportResponse>();

        Assert.True(response.IsSuccessStatusCode);
        Assert.NotNull(payload);
        Assert.Equal(10, payload.ImagesImported);
        Assert.Equal(3, payload.GalleriesImported);
        Assert.Equal(4, payload.BooksImported);
        Assert.Equal(2, payload.AudioLibrariesImported);
        Assert.Equal(12, payload.AudioTracksImported);
        Assert.Equal(18, payload.LinksImported);
    }

    private sealed class AcceptedGate : IV2UpgradeGate
    {
        public V2UpgradeGateStatus Check()
        {
            return new V2UpgradeGateStatus("v2-global-entities", true, "/tmp/accepted");
        }

        public V2UpgradeGateStatus Accept()
        {
            return Check();
        }

        public V2UpgradeGateStatus Prompt()
        {
            return new V2UpgradeGateStatus("v2-global-entities", false, "/tmp/accepted");
        }
    }

    private sealed class FakeFreshStartService : IV2FreshStartService
    {
        private bool _prepared;

        public int PrepareCalls { get; private set; }

        public int ResetCalls { get; private set; }

        public int ClearPreparedCalls { get; private set; }

        public Task<V2FreshStartResult> PrepareAsync(CancellationToken cancellationToken)
        {
            if (_prepared)
            {
                return Task.FromResult(new V2FreshStartResult(
                    string.Empty,
                    PreservedLibraryRoots: 2,
                    PreservedSettings: true,
                    MediaReset: false,
                    CachePurged: false)
                {
                    AlreadyPrepared = true
                });
            }

            PrepareCalls++;
            return Task.FromResult(new V2FreshStartResult(
                "/data/backups/obscura-pre-v2.dump",
                PreservedLibraryRoots: 2,
                PreservedSettings: true,
                MediaReset: true,
                CachePurged: true));
        }

        public Task MarkPreparedAsync(CancellationToken cancellationToken)
        {
            _prepared = true;
            return Task.CompletedTask;
        }

        public Task ResetAsync(CancellationToken cancellationToken)
        {
            ResetCalls++;
            _prepared = false;
            return Task.CompletedTask;
        }

        public Task ClearPreparedAsync(CancellationToken cancellationToken)
        {
            ClearPreparedCalls++;
            _prepared = false;
            return Task.CompletedTask;
        }

        public Task PurgeNonSourceEntityFilesAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }

    private sealed class FakeLegacyVideoImportService : ILegacyVideoImportService
    {
        public int ImportCalls { get; private set; }

        public Task<LegacyVideoImportResult> ImportAsync(CancellationToken cancellationToken)
        {
            ImportCalls++;
            return Task.FromResult(new LegacyVideoImportResult(
                SeriesImported: 3,
                VideosImported: 12,
                PeopleImported: 6,
                TagsImported: 4,
                StudiosImported: 2,
                LinksImported: 9));
        }
    }

    private sealed class FakeLegacyMediaImportService : ILegacyMediaImportService
    {
        public int ImportCalls { get; private set; }

        public Task<LegacyMediaImportResult> ImportAsync(CancellationToken cancellationToken)
        {
            ImportCalls++;
            return Task.FromResult(new LegacyMediaImportResult(
                ImagesImported: 10,
                GalleriesImported: 3,
                BooksImported: 4,
                AudioLibrariesImported: 2,
                AudioTracksImported: 12,
                CollectionsImported: 5,
                LinksImported: 18));
        }
    }
}

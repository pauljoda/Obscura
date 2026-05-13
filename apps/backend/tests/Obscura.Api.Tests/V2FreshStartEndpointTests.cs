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
    public async Task PrepareEndpointRunsFreshStartWhenGateIsAccepted()
    {
        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    services.AddSingleton<IV2UpgradeGate, AcceptedGate>();
                    services.AddSingleton<IV2FreshStartService, FakeFreshStartService>();
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
        public Task<V2FreshStartResult> PrepareAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(new V2FreshStartResult(
                "/data/backups/obscura-pre-v2.dump",
                PreservedLibraryRoots: 2,
                PreservedSettings: true,
                MediaReset: true));
        }
    }

    private sealed class FakeLegacyVideoImportService : ILegacyVideoImportService
    {
        public Task<LegacyVideoImportResult> ImportAsync(CancellationToken cancellationToken)
        {
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
        public Task<LegacyMediaImportResult> ImportAsync(CancellationToken cancellationToken)
        {
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

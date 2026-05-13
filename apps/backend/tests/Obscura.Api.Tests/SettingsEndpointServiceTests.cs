using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Obscura.Application.Settings;
using Obscura.Contracts.Settings;

namespace Obscura.Api.Tests;

public sealed class SettingsEndpointServiceTests
{
    [Fact]
    public async Task SettingsEndpointReadsAndUpdatesThroughService()
    {
        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    services.AddScoped<ISettingsService, FakeSettingsService>();
                });
            });
        using var client = factory.CreateClient();

        var before = await client.GetFromJsonAsync<SettingsResponse>("/api/settings");
        var after = await client.PatchAsJsonAsync("/api/settings", new SettingsUpdateRequest(true, false));
        var updated = await after.Content.ReadFromJsonAsync<SettingsResponse>();

        Assert.NotNull(before);
        Assert.False(before.HideNsfw);
        Assert.True(before.EnableCastControls);
        Assert.NotNull(updated);
        Assert.True(updated.HideNsfw);
        Assert.False(updated.EnableCastControls);
    }

    [Fact]
    public async Task LibrarySettingsEndpointsUseV2SettingsService()
    {
        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    services.AddScoped<ISettingsService, FakeSettingsService>();
                });
            });
        using var client = factory.CreateClient();

        var config = await client.GetFromJsonAsync<LibraryConfigResponse>("/api/settings/library");
        var updated = await client.PutAsJsonAsync(
            "/api/settings/library",
            new LibrarySettingsUpdateRequest(
                null, 15, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null));
        var root = await client.PostAsJsonAsync(
            "/api/libraries",
            new LibraryRootCreateRequest("/media/videos", "Videos", null, null, null, null, null, null, null));

        Assert.NotNull(config);
        Assert.Single(config.Roots);
        Assert.True(updated.IsSuccessStatusCode);
        Assert.True(root.IsSuccessStatusCode);
    }

    private sealed class FakeSettingsService : ISettingsService
    {
        private static readonly Guid SettingsId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        private static readonly Guid RootId = Guid.Parse("22222222-2222-2222-2222-222222222222");

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
            return Task.FromResult(new LibraryConfigResponse(
                SampleSettings(),
                [SampleRoot()]));
        }

        public Task<LibrarySettings> UpdateLibrarySettingsAsync(
            LibrarySettingsUpdateRequest request,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(SampleSettings() with
            {
                ScanIntervalMinutes = request.ScanIntervalMinutes ?? 60
            });
        }

        public Task<LibraryBrowseResponse> BrowseLibraryPathAsync(
            string? path,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(new LibraryBrowseResponse(
                path ?? "/media",
                "/",
                [new LibraryBrowseEntry("videos", "/media/videos")]));
        }

        public Task<LibraryRoot> CreateLibraryRootAsync(
            LibraryRootCreateRequest request,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(SampleRoot() with
            {
                Path = request.Path,
                Label = request.Label ?? "Videos"
            });
        }

        public Task<LibraryRoot?> UpdateLibraryRootAsync(
            Guid id,
            LibraryRootUpdateRequest request,
            CancellationToken cancellationToken)
        {
            return Task.FromResult<LibraryRoot?>(SampleRoot());
        }

        public Task<bool> DeleteLibraryRootAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult(true);
        }

        private static LibrarySettings SampleSettings()
        {
            return new LibrarySettings(
                SettingsId,
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

        private static LibraryRoot SampleRoot()
        {
            return new LibraryRoot(
                RootId,
                "/media/videos",
                "Videos",
                true,
                true,
                true,
                false,
                false,
                false,
                false,
                null,
                DateTimeOffset.UnixEpoch,
                DateTimeOffset.UnixEpoch);
        }
    }
}

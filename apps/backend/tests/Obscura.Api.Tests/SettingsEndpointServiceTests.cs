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

    private sealed class FakeSettingsService : ISettingsService
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

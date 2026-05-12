using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Obscura.Contracts.Settings;
using Obscura.Infrastructure.Settings;

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

        var before = await client.GetFromJsonAsync<SettingsDto>("/api/settings");
        var after = await client.PatchAsJsonAsync("/api/settings", new SettingsUpdateRequestDto(true, false));
        var updated = await after.Content.ReadFromJsonAsync<SettingsDto>();

        Assert.NotNull(before);
        Assert.False(before.HideNsfw);
        Assert.True(before.EnableCastControls);
        Assert.NotNull(updated);
        Assert.True(updated.HideNsfw);
        Assert.False(updated.EnableCastControls);
    }

    private sealed class FakeSettingsService : ISettingsService
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

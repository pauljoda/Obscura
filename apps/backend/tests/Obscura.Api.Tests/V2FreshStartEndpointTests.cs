using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Obscura.Contracts.System;
using Obscura.Infrastructure.FreshStart;
using Obscura.Infrastructure.Upgrades;

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
        var payload = await response.Content.ReadFromJsonAsync<V2FreshStartPrepareResponseDto>();

        Assert.True(response.IsSuccessStatusCode);
        Assert.NotNull(payload);
        Assert.Equal("/data/backups/obscura-pre-v2.dump", payload.BackupPath);
        Assert.Equal(2, payload.PreservedLibraryRoots);
        Assert.True(payload.PreservedSettings);
    }

    private sealed class AcceptedGate : IV2UpgradeGate
    {
        public V2UpgradeGateStatus Check()
        {
            return new V2UpgradeGateStatus(V2UpgradeGate.GateId, true, "/tmp/accepted");
        }

        public V2UpgradeGateStatus Accept()
        {
            return Check();
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
}

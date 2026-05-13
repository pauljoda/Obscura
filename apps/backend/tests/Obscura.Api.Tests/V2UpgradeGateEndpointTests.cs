using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Obscura.Api.Tests;

public sealed class V2UpgradeGateEndpointTests : IDisposable
{
    private readonly string _tempDir = Path.Combine(Path.GetTempPath(), $"obscura-api-v2-gate-{Guid.NewGuid():N}");
    private readonly WebApplicationFactory<Program> _factory;

    public V2UpgradeGateEndpointTests()
    {
        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder => builder.UseSetting("Obscura:DataDir", _tempDir));
    }

    [Fact]
    public async Task GateEndpointReportsAndAcceptsConsent()
    {
        using var client = _factory.CreateClient();

        var before = await client.GetFromJsonAsync<GateResponse>("/api/system/v2-upgrade-gate");
        using var acceptedResponse = await client.PostAsync("/api/system/v2-upgrade-gate/accept", null);
        var after = await acceptedResponse.Content.ReadFromJsonAsync<GateResponse>();

        Assert.NotNull(before);
        Assert.False(before.Accepted);
        Assert.NotNull(after);
        Assert.True(after.Accepted);
    }

    [Fact]
    public async Task PromptEndpointRearmsConsentGate()
    {
        using var client = _factory.CreateClient();

        using var acceptedResponse = await client.PostAsync("/api/system/v2-upgrade-gate/accept", null);
        var accepted = await acceptedResponse.Content.ReadFromJsonAsync<GateResponse>();
        using var promptedResponse = await client.PostAsync("/api/system/v2-upgrade-gate/prompt", null);
        var prompted = await promptedResponse.Content.ReadFromJsonAsync<GateResponse>();

        Assert.NotNull(accepted);
        Assert.True(accepted.Accepted);
        Assert.NotNull(prompted);
        Assert.False(prompted.Accepted);
    }

    public void Dispose()
    {
        _factory.Dispose();
        if (Directory.Exists(_tempDir))
        {
            Directory.Delete(_tempDir, recursive: true);
        }
    }

    private sealed record GateResponse(string GateId, bool Accepted);
}

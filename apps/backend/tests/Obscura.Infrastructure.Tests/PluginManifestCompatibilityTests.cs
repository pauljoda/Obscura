using Obscura.Contracts.Plugins;
using Obscura.Infrastructure.Plugins;

namespace Obscura.Infrastructure.Tests;

public sealed class PluginManifestCompatibilityTests {
    [Fact]
    public void FiltersToV2DotnetPluginsCompatibleWithCurrentAppVersion() {
        var current = new Version(0, 22, 1);
        var candidates = new[]
        {
            Entry("tmdb", "0.9.0", ["v1"], "typescript", "0.1.0", null),
            Entry("tmdb", "1.0.0", ["v2"], "dotnet-process", "0.21.0", "0.22.0"),
            Entry("tmdb", "1.1.0", ["v2"], "dotnet-process", "0.22.0", null),
            Entry("other", "1.0.0", ["v2"], "dotnet-process", "0.22.0", null)
        };

        var result = PluginCompatibilityResolver.LatestCompatible(candidates, "tmdb", current);

        Assert.NotNull(result);
        Assert.Equal("1.1.0", result.Version);
    }

    private static PluginIndexEntryV2 Entry(
        string id,
        string version,
        string[] apiTags,
        string runtime,
        string appMin,
        string? appMax) =>
        new(
            Id: id,
            Name: id,
            Version: version,
            Date: "2026-05-16",
            Path: $"plugins/{id}/{id}.zip",
            Sha256: "abc",
            Runtime: runtime,
            IsNsfw: false,
            ManifestVersion: 2,
            ApiTags: apiTags,
            Compat: new PluginCompatibility("2.0.0", null, appMin, appMax),
            Supports: []);
}

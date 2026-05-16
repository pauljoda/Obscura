using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Obscura.Contracts.Plugins;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Plugins;
using Obscura.Infrastructure.Processes;

namespace Obscura.Infrastructure.Tests;

public sealed class PluginRuntimeServiceTests : IDisposable
{
    private readonly string _tempRoot = Path.Combine(Path.GetTempPath(), $"obscura-plugin-tests-{Guid.NewGuid():N}");

    [Fact]
    public async Task CatalogDiscoversOnlyCompatibleV2DotnetManifests()
    {
        var pluginDir = Path.Combine(_tempRoot, "tmdb");
        Directory.CreateDirectory(pluginDir);
        await File.WriteAllTextAsync(
            Path.Combine(pluginDir, "manifest.v2.json"),
            """
            {
              "manifestVersion": 2,
              "apiTags": ["v2"],
              "id": "tmdb",
              "name": "TMDB",
              "version": "1.2.0",
              "runtime": "dotnet-process",
              "entry": "Obscura.Plugin.Tmdb.dll",
              "compat": {
                "pluginApiMin": "2.0.0",
                "pluginApiMax": null,
                "obscuraMin": "0.22.0",
                "obscuraMax": null
              },
              "auth": [
                { "key": "apiKey", "label": "API key", "required": true, "url": "https://www.themoviedb.org/settings/api" }
              ],
              "supports": [
                { "entityKind": "video", "actions": ["lookup-id", "lookup-url", "search"] }
              ]
            }
            """);
        Directory.CreateDirectory(Path.Combine(_tempRoot, "old"));
        await File.WriteAllTextAsync(
            Path.Combine(_tempRoot, "old", "manifest.json"),
            """{ "manifestVersion": 1, "apiTags": ["v1"], "id": "old", "name": "Old", "version": "1.0.0", "runtime": "typescript" }""");

        await using var db = CreateContext();
        var catalog = new PluginCatalogService(db, new PluginCatalogOptions([_tempRoot], _tempRoot, "0.22.1-dev"));

        var providers = await catalog.ListProvidersAsync(CancellationToken.None);

        var provider = Assert.Single(providers);
        Assert.Equal("tmdb", provider.Id);
        Assert.False(provider.Installed);
        Assert.Contains("apiKey", provider.MissingAuthKeys);
    }

    [Fact]
    public async Task ProcessRunnerWritesRequestFileAndReadsStdoutResponse()
    {
        var executor = new CapturingProcessExecutor();
        var runner = new DotnetPluginProcessRunner(
            executor,
            new PluginCatalogOptions([], _tempRoot, "0.22.1-dev"));
        var descriptor = new PluginDescriptor(
            Manifest: new PluginManifestV2(
                2,
                ["v2"],
                "tmdb",
                "TMDB",
                "1.0.0",
                "dotnet-process",
                "tmdb.dll",
                new PluginCompatibility("2.0.0", null, "0.22.0", null),
                [],
                []),
            ManifestPath: Path.Combine(_tempRoot, "manifest.v2.json"),
            WorkingDirectory: _tempRoot,
            EntryPath: Path.Combine(_tempRoot, "tmdb.dll"));
        var entityId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var request = new IdentifyPluginRequest(
            2,
            "lookup-id",
            new Dictionary<string, string> { ["apiKey"] = "secret" },
            new IdentifyEntitySnapshot(entityId, "video", "Example"),
            new IdentifyQuery(null, null, null),
            new IdentifyMatchHints(
                new Dictionary<string, string> { ["tmdb"] = "123" },
                [],
                "Example",
                "/media/example.mkv"));

        var response = await runner.IdentifyAsync(descriptor, request, CancellationToken.None);

        Assert.True(response.Ok);
        Assert.Equal("tmdb", response.Result?.Provider);
        Assert.Equal("dotnet", executor.FileName);
        Assert.Equal(descriptor.EntryPath, executor.Arguments[0]);
        Assert.Equal(entityId, executor.CapturedRequest?.Entity.Id);
        Assert.Equal("lookup-id", executor.CapturedRequest?.Action);
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempRoot))
        {
            Directory.Delete(_tempRoot, recursive: true);
        }
    }

    private static ObscuraDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ObscuraDbContext>()
            .UseInMemoryDatabase($"plugin-runtime-{Guid.NewGuid():N}")
            .Options;

        return new ObscuraDbContext(options);
    }

    private sealed class CapturingProcessExecutor : ProcessExecutor
    {
        public string? FileName { get; private set; }
        public IReadOnlyList<string> Arguments { get; private set; } = [];
        public IdentifyPluginRequest? CapturedRequest { get; private set; }

        public override async Task<ProcessExecutionResult> RunAsync(
            string fileName,
            IReadOnlyList<string> arguments,
            IReadOnlyDictionary<string, string>? environment,
            CancellationToken cancellationToken)
        {
            FileName = fileName;
            Arguments = arguments.ToArray();
            var requestJson = await File.ReadAllTextAsync(arguments[1], cancellationToken);
            CapturedRequest = JsonSerializer.Deserialize<IdentifyPluginRequest>(
                requestJson,
                new JsonSerializerOptions(JsonSerializerDefaults.Web));
            var response = new IdentifyPluginResponse(
                true,
                new EntityMetadataProposal(
                    "tmdb:123",
                    "tmdb",
                    "video",
                    1,
                    "external-id",
                    new EntityMetadataPatch(
                        "Example",
                        null,
                        new Dictionary<string, string> { ["tmdb"] = "123" },
                        [],
                        [],
                        null,
                        [],
                        new Dictionary<string, string>(),
                        new Dictionary<string, int>(),
                        new Dictionary<string, int>(),
                        new Dictionary<string, int>(),
                        null),
                    [],
                    [],
                    []),
                null);

            return new ProcessExecutionResult(
                0,
                JsonSerializer.Serialize(response, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                string.Empty);
        }
    }
}

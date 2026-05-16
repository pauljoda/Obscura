using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Obscura.Contracts.Plugins;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;
using Obscura.Infrastructure.Processes;

namespace Obscura.Infrastructure.Plugins;

/// <summary>
/// Runtime configuration for v2 community plugin discovery and execution.
/// </summary>
/// <param name="DevPaths">Local plugin repository or plugin directories to scan during development.</param>
/// <param name="CacheRoot">Cache directory used for transient plugin request envelopes.</param>
/// <param name="CurrentObscuraVersion">Current Obscura version used for compatibility gating.</param>
public sealed record PluginCatalogOptions(
    IReadOnlyList<string> DevPaths,
    string CacheRoot,
    string CurrentObscuraVersion);

/// <summary>
/// Resolved local plugin artifact ready to execute.
/// </summary>
/// <param name="Manifest">V2 manifest declared by the plugin.</param>
/// <param name="ManifestPath">Absolute manifest file path.</param>
/// <param name="WorkingDirectory">Plugin directory used as the process working context.</param>
/// <param name="EntryPath">Absolute entry assembly or executable path.</param>
public sealed record PluginDescriptor(
    PluginManifestV2 Manifest,
    string ManifestPath,
    string WorkingDirectory,
    string EntryPath);

/// <summary>
/// Discovers v2 plugin manifests, applies compatibility gates, and stores installed provider state.
/// </summary>
public sealed class PluginCatalogService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = false
    };

    private readonly ObscuraDbContext _db;
    private readonly PluginCatalogOptions _options;

    public PluginCatalogService(ObscuraDbContext db, PluginCatalogOptions options)
    {
        _db = db;
        _options = options;
    }

    /// <summary>
    /// Lists locally discoverable v2 providers and overlays installed/auth state from the database.
    /// </summary>
    public async Task<IReadOnlyList<PluginProvider>> ListProvidersAsync(CancellationToken cancellationToken)
    {
        var descriptors = await DiscoverAsync(cancellationToken);
        var configs = await _db.ProviderConfigs
            .AsNoTracking()
            .ToDictionaryAsync(row => row.ProviderCode, StringComparer.OrdinalIgnoreCase, cancellationToken);
        var credentialRows = await _db.ProviderCredentials
            .AsNoTracking()
            .Join(
                _db.ProviderConfigs.AsNoTracking(),
                credential => credential.ProviderConfigId,
                config => config.Id,
                (credential, config) => new { config.ProviderCode, credential.CredentialKey, credential.EncryptedValue })
            .Where(row => row.EncryptedValue != string.Empty)
            .ToArrayAsync(cancellationToken);
        var credentialKeys = credentialRows
            .GroupBy(row => row.ProviderCode, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => group.Select(row => row.CredentialKey).ToHashSet(StringComparer.OrdinalIgnoreCase),
                StringComparer.OrdinalIgnoreCase);

        return descriptors
            .Select(descriptor =>
            {
                configs.TryGetValue(descriptor.Manifest.Id, out var config);
                credentialKeys.TryGetValue(descriptor.Manifest.Id, out var keys);
                keys ??= [];
                var missing = descriptor.Manifest.Auth
                    .Where(field => field.Required && !keys.Contains(field.Key) && !HasEnvironmentCredential(descriptor.Manifest.Id, field.Key))
                    .Select(field => field.Key)
                    .ToArray();

                return new PluginProvider(
                    descriptor.Manifest.Id,
                    descriptor.Manifest.Name,
                    descriptor.Manifest.Version,
                    Installed: config is not null,
                    Enabled: config?.Enabled ?? false,
                    descriptor.Manifest.Supports,
                    descriptor.Manifest.Auth,
                    missing);
            })
            .OrderBy(provider => provider.Name)
            .ToArray();
    }

    /// <summary>
    /// Finds the latest compatible local provider artifact for an identify request.
    /// </summary>
    public async Task<PluginDescriptor?> FindProviderAsync(
        string providerId,
        string? entityKind,
        CancellationToken cancellationToken)
    {
        var descriptors = await DiscoverAsync(cancellationToken);
        return descriptors
            .Where(descriptor => descriptor.Manifest.Id.Equals(providerId, StringComparison.OrdinalIgnoreCase))
            .Where(descriptor => entityKind is null || descriptor.Manifest.Supports.Any(support =>
                support.EntityKind.Equals(entityKind, StringComparison.OrdinalIgnoreCase)))
            .OrderByDescending(descriptor => ParseVersion(descriptor.Manifest.Version))
            .FirstOrDefault();
    }

    /// <summary>
    /// Saves a provider config row so the plugin is visible as installed/enabled.
    /// </summary>
    public async Task<PluginProvider?> InstallAsync(string providerId, CancellationToken cancellationToken)
    {
        var descriptor = await FindProviderAsync(providerId, null, cancellationToken);
        if (descriptor is null)
        {
            return null;
        }

        var now = DateTimeOffset.UtcNow;
        var config = await _db.ProviderConfigs
            .FirstOrDefaultAsync(row => row.ProviderCode == providerId, cancellationToken);
        if (config is null)
        {
            config = new ProviderConfigRow
            {
                Id = Guid.NewGuid(),
                ProviderCode = descriptor.Manifest.Id,
                CreatedAt = now
            };
            _db.ProviderConfigs.Add(config);
        }

        config.DisplayName = descriptor.Manifest.Name;
        config.ProviderType = ProviderType.ExternalProcess;
        config.SettingsJson = JsonSerializer.Serialize(new InstalledPluginSettings(
            descriptor.Manifest.Version,
            descriptor.ManifestPath,
            descriptor.EntryPath), JsonOptions);
        config.Enabled = true;
        config.IsNsfw = false;
        config.UpdatedAt = now;
        await _db.SaveChangesAsync(cancellationToken);

        return (await ListProvidersAsync(cancellationToken))
            .FirstOrDefault(provider => provider.Id.Equals(providerId, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// Removes installed provider state while leaving local plugin files untouched.
    /// </summary>
    public async Task<bool> RemoveAsync(string providerId, CancellationToken cancellationToken)
    {
        var config = await _db.ProviderConfigs
            .FirstOrDefaultAsync(row => row.ProviderCode == providerId, cancellationToken);
        if (config is null)
        {
            return false;
        }

        _db.ProviderConfigs.Remove(config);
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    /// <summary>
    /// Stores credential values for a provider in the existing provider credential table.
    /// </summary>
    public async Task<bool> SaveAuthAsync(
        string providerId,
        IReadOnlyDictionary<string, string?> values,
        CancellationToken cancellationToken)
    {
        var provider = await InstallAsync(providerId, cancellationToken);
        if (provider is null)
        {
            return false;
        }

        var config = await _db.ProviderConfigs
            .SingleAsync(row => row.ProviderCode == providerId, cancellationToken);
        var existing = await _db.ProviderCredentials
            .Where(row => row.ProviderConfigId == config.Id)
            .ToDictionaryAsync(row => row.CredentialKey, StringComparer.OrdinalIgnoreCase, cancellationToken);
        var now = DateTimeOffset.UtcNow;

        foreach (var (key, value) in values)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                if (existing.TryGetValue(key, out var removed))
                {
                    _db.ProviderCredentials.Remove(removed);
                }

                continue;
            }

            if (!existing.TryGetValue(key, out var credential))
            {
                credential = new ProviderCredentialRow
                {
                    Id = Guid.NewGuid(),
                    ProviderConfigId = config.Id,
                    CredentialKey = key,
                    CreatedAt = now
                };
                _db.ProviderCredentials.Add(credential);
            }

            credential.EncryptedValue = value;
            credential.UpdatedAt = now;
        }

        config.UpdatedAt = now;
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    /// <summary>
    /// Reads credentials from provider storage plus environment overrides.
    /// </summary>
    public async Task<IReadOnlyDictionary<string, string>> GetAuthAsync(
        PluginManifestV2 manifest,
        CancellationToken cancellationToken)
    {
        var config = await _db.ProviderConfigs
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.ProviderCode == manifest.Id && row.Enabled, cancellationToken);
        var stored = config is null
            ? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            : await _db.ProviderCredentials
                .AsNoTracking()
                .Where(row => row.ProviderConfigId == config.Id)
                .ToDictionaryAsync(row => row.CredentialKey, row => row.EncryptedValue, StringComparer.OrdinalIgnoreCase, cancellationToken);

        foreach (var field in manifest.Auth)
        {
            var value = Environment.GetEnvironmentVariable(EnvironmentCredentialKey(manifest.Id, field.Key));
            if (!string.IsNullOrWhiteSpace(value))
            {
                stored[field.Key] = value;
            }
        }

        return stored;
    }

    private async Task<IReadOnlyList<PluginDescriptor>> DiscoverAsync(CancellationToken cancellationToken)
    {
        var current = ParseVersion(_options.CurrentObscuraVersion);
        var descriptors = new List<PluginDescriptor>();

        foreach (var root in _options.DevPaths.Where(Directory.Exists).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            foreach (var manifestPath in EnumerateManifestPaths(root))
            {
                cancellationToken.ThrowIfCancellationRequested();
                var manifest = await ReadManifestAsync(manifestPath, cancellationToken);
                if (manifest is null || !IsCompatible(manifest, current))
                {
                    continue;
                }

                var directory = Path.GetDirectoryName(manifestPath) ?? root;
                var entryPath = Path.GetFullPath(Path.IsPathRooted(manifest.Entry)
                    ? manifest.Entry
                    : Path.Combine(directory, manifest.Entry));
                descriptors.Add(new PluginDescriptor(manifest, manifestPath, directory, entryPath));
            }
        }

        return descriptors
            .GroupBy(descriptor => descriptor.Manifest.Id, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.OrderByDescending(descriptor => ParseVersion(descriptor.Manifest.Version)).First())
            .ToArray();
    }

    private static IEnumerable<string> EnumerateManifestPaths(string root)
    {
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "manifest.v2.json",
            "plugin.v2.json",
            "manifest.json",
            "plugin.json"
        };

        return Directory.EnumerateFiles(root, "*.json", SearchOption.AllDirectories)
            .Where(path => names.Contains(Path.GetFileName(path)));
    }

    private static async Task<PluginManifestV2?> ReadManifestAsync(string path, CancellationToken cancellationToken)
    {
        try
        {
            await using var stream = File.OpenRead(path);
            return await JsonSerializer.DeserializeAsync<PluginManifestV2>(stream, JsonOptions, cancellationToken);
        }
        catch (JsonException)
        {
            return null;
        }
        catch (IOException)
        {
            return null;
        }
    }

    private static bool IsCompatible(PluginManifestV2 manifest, Version current)
    {
        if (manifest.ManifestVersion != 2 ||
            !manifest.Runtime.Equals("dotnet-process", StringComparison.OrdinalIgnoreCase) ||
            !manifest.ApiTags.Contains("v2", StringComparer.OrdinalIgnoreCase))
        {
            return false;
        }

        var min = ParseVersion(manifest.Compat.ObscuraMin);
        var max = string.IsNullOrWhiteSpace(manifest.Compat.ObscuraMax)
            ? null
            : ParseVersion(manifest.Compat.ObscuraMax);
        return current >= min && (max is null || current <= max);
    }

    private static bool HasEnvironmentCredential(string providerId, string key) =>
        !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(EnvironmentCredentialKey(providerId, key)));

    private static string EnvironmentCredentialKey(string providerId, string key) =>
        $"OBSCURA_PLUGIN_{providerId.Replace('-', '_').ToUpperInvariant()}_{key.Replace('-', '_').ToUpperInvariant()}";

    private static Version ParseVersion(string version)
    {
        var normalized = version.Split('-', 2)[0];
        return Version.TryParse(normalized, out var parsed) ? parsed : new Version(0, 0, 0);
    }

    private sealed record InstalledPluginSettings(string Version, string ManifestPath, string EntryPath);
}

/// <summary>
/// Executes v2 dotnet-process plugins as short-lived child processes.
/// </summary>
public sealed class DotnetPluginProcessRunner
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = false
    };

    private readonly ProcessExecutor _processes;
    private readonly PluginCatalogOptions _options;

    public DotnetPluginProcessRunner(ProcessExecutor processes, PluginCatalogOptions options)
    {
        _processes = processes;
        _options = options;
    }

    /// <summary>
    /// Runs one identify request and parses the plugin response from stdout.
    /// </summary>
    public async Task<IdentifyPluginResponse> IdentifyAsync(
        PluginDescriptor descriptor,
        IdentifyPluginRequest request,
        CancellationToken cancellationToken)
    {
        var requestDirectory = Path.Combine(_options.CacheRoot, "plugins", "requests");
        Directory.CreateDirectory(requestDirectory);
        var requestPath = Path.Combine(requestDirectory, $"{Guid.NewGuid():N}.json");
        await File.WriteAllTextAsync(
            requestPath,
            JsonSerializer.Serialize(request, JsonOptions),
            cancellationToken);

        try
        {
            var result = await _processes.RunAsync(
                "dotnet",
                [descriptor.EntryPath, requestPath],
                environment: null,
                cancellationToken);

            if (result.ExitCode != 0)
            {
                return new IdentifyPluginResponse(
                    false,
                    null,
                    string.IsNullOrWhiteSpace(result.StandardError)
                        ? $"Plugin exited with code {result.ExitCode}."
                        : result.StandardError.Trim());
            }

            return JsonSerializer.Deserialize<IdentifyPluginResponse>(result.StandardOutput, JsonOptions)
                ?? new IdentifyPluginResponse(false, null, "Plugin returned an empty response.");
        }
        catch (JsonException ex)
        {
            return new IdentifyPluginResponse(false, null, $"Plugin returned invalid JSON: {ex.Message}");
        }
        finally
        {
            TryDelete(requestPath);
        }
    }

    private static void TryDelete(string path)
    {
        try
        {
            File.Delete(path);
        }
        catch (IOException)
        {
        }
        catch (UnauthorizedAccessException)
        {
        }
    }
}

/// <summary>
/// Coordinates provider selection, ID-first match hints, plugin execution, and metadata application.
/// </summary>
public sealed class IdentifyPluginService
{
    private readonly ObscuraDbContext _db;
    private readonly PluginCatalogService _catalog;
    private readonly IdentifyMatchHintResolver _hints;
    private readonly DotnetPluginProcessRunner _runner;
    private readonly EntityMetadataApplyService _apply;

    public IdentifyPluginService(
        ObscuraDbContext db,
        PluginCatalogService catalog,
        IdentifyMatchHintResolver hints,
        DotnetPluginProcessRunner runner,
        EntityMetadataApplyService apply)
    {
        _db = db;
        _catalog = catalog;
        _hints = hints;
        _runner = runner;
        _apply = apply;
    }

    /// <summary>
    /// Lists enabled v2 providers that can identify the requested entity kind.
    /// </summary>
    public async Task<IReadOnlyList<PluginProvider>> ListProvidersAsync(string? entityKind, CancellationToken cancellationToken)
    {
        var providers = await _catalog.ListProvidersAsync(cancellationToken);
        return providers
            .Where(provider => entityKind is null || provider.Supports.Any(support =>
                support.EntityKind.Equals(entityKind, StringComparison.OrdinalIgnoreCase)))
            .ToArray();
    }

    /// <summary>
    /// Runs one transient identify lookup for an entity.
    /// </summary>
    public async Task<IdentifyPluginResponse> IdentifyAsync(
        Guid entityId,
        string providerId,
        IdentifyQuery? query,
        CancellationToken cancellationToken)
    {
        var entity = await _db.Entities
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.Id == entityId && row.DeletedAt == null, cancellationToken);
        if (entity is null)
        {
            return new IdentifyPluginResponse(false, null, $"Entity '{entityId}' was not found.");
        }

        var descriptor = await _catalog.FindProviderAsync(providerId, entity.KindCode, cancellationToken);
        if (descriptor is null)
        {
            return new IdentifyPluginResponse(false, null, $"No compatible v2 provider '{providerId}' supports '{entity.KindCode}'.");
        }

        var auth = await _catalog.GetAuthAsync(descriptor.Manifest, cancellationToken);
        var missingAuth = descriptor.Manifest.Auth
            .Where(field => field.Required && !auth.ContainsKey(field.Key))
            .Select(field => field.Key)
            .ToArray();
        if (missingAuth.Length > 0)
        {
            return new IdentifyPluginResponse(false, null, $"Missing required plugin credentials: {string.Join(", ", missingAuth)}.");
        }

        var hints = await _hints.ResolveAsync(entityId, descriptor.Manifest.Id, cancellationToken);
        var request = new IdentifyPluginRequest(
            ProtocolVersion: 2,
            Action: ResolveAction(descriptor.Manifest, query, hints),
            Auth: auth,
            Entity: new IdentifyEntitySnapshot(entity.Id, entity.KindCode, entity.Title),
            Query: query ?? new IdentifyQuery(null, null, null),
            Hints: hints);

        return await _runner.IdentifyAsync(descriptor, request, cancellationToken);
    }

    /// <summary>
    /// Applies selected metadata proposal fields to an entity.
    /// </summary>
    public Task<bool> ApplyAsync(
        Guid entityId,
        EntityMetadataProposal proposal,
        IReadOnlyCollection<string> selectedFields,
        IReadOnlyDictionary<string, string?>? selectedImages,
        CancellationToken cancellationToken) =>
        _apply.ApplyAsync(entityId, proposal, selectedFields, selectedImages, cancellationToken);

    private static string ResolveAction(
        PluginManifestV2 manifest,
        IdentifyQuery? query,
        IdentifyMatchHints hints)
    {
        var supports = manifest.Supports
            .SelectMany(support => support.Actions)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var hasExplicitId = query?.ExternalIds?.ContainsKey(manifest.Id) == true ||
            hints.ExternalIds.ContainsKey(manifest.Id);

        if (hasExplicitId && supports.Contains("lookup-id"))
        {
            return "lookup-id";
        }

        if ((!string.IsNullOrWhiteSpace(query?.Url) || hints.Urls.Count > 0) && supports.Contains("lookup-url"))
        {
            return "lookup-url";
        }

        return supports.Contains("search") ? "search" : supports.FirstOrDefault() ?? "search";
    }
}

/// <summary>
/// In-memory bulk identify session store for review data that should not survive process restarts.
/// </summary>
public sealed class IdentifySessionStore
{
    private readonly ConcurrentDictionary<Guid, IdentifyBulkSession> _sessions = new();

    public IdentifyBulkSession Create(IReadOnlyList<Guid> entityIds, string provider)
    {
        var session = new IdentifyBulkSession(Guid.NewGuid(), provider, entityIds, [], "running", DateTimeOffset.UtcNow);
        _sessions[session.Id] = session;
        return session;
    }

    public IdentifyBulkSession? Get(Guid id) => _sessions.TryGetValue(id, out var session) ? session : null;

    public void Complete(Guid id, IReadOnlyList<IdentifyBulkResult> results)
    {
        if (_sessions.TryGetValue(id, out var session))
        {
            _sessions[id] = session with { Results = results, Status = "completed" };
        }
    }

    public bool Close(Guid id) => _sessions.TryRemove(id, out _);
}

public sealed record IdentifyBulkSession(
    Guid Id,
    string Provider,
    IReadOnlyList<Guid> EntityIds,
    IReadOnlyList<IdentifyBulkResult> Results,
    string Status,
    DateTimeOffset CreatedAt);

public sealed record IdentifyBulkResult(Guid EntityId, IdentifyPluginResponse Response);

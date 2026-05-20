namespace Obscura.Contracts.Plugins;

/// <summary>
/// Compatibility bounds declared by a v2 plugin artifact.
/// </summary>
/// <param name="PluginApiMin">Minimum plugin protocol version supported by the artifact.</param>
/// <param name="PluginApiMax">Optional maximum plugin protocol version supported by the artifact.</param>
/// <param name="ObscuraMin">Minimum Obscura application version supported by the artifact.</param>
/// <param name="ObscuraMax">Optional maximum Obscura application version supported by the artifact.</param>
public sealed record PluginCompatibility(
    string PluginApiMin,
    string? PluginApiMax,
    string ObscuraMin,
    string? ObscuraMax);

/// <summary>
/// Authentication field requested by a plugin.
/// </summary>
/// <param name="Key">Stable credential key passed to the plugin process.</param>
/// <param name="Label">Human-readable label shown in plugin settings.</param>
/// <param name="Required">Whether identify actions should be blocked when the credential is missing.</param>
/// <param name="Url">Optional upstream URL where users can create or manage the credential.</param>
public sealed record PluginAuthField(
    string Key,
    string Label,
    bool Required,
    string? Url);

/// <summary>
/// Entity kind and identify actions supported by a plugin artifact.
/// </summary>
/// <param name="EntityKind">Stable Obscura entity kind code.</param>
/// <param name="Actions">Supported action codes such as lookup-id, lookup-url, search, and cascade.</param>
public sealed record PluginEntitySupport(
    string EntityKind,
    IReadOnlyList<string> Actions);

/// <summary>
/// Manifest embedded in a v2 community plugin artifact.
/// </summary>
/// <param name="ManifestVersion">Manifest schema version; v2 requires 2.</param>
/// <param name="ApiTags">Generation tags used by Obscura to ignore older plugin systems.</param>
/// <param name="Id">Stable provider/plugin code such as tmdb.</param>
/// <param name="Name">Human-readable plugin name.</param>
/// <param name="Version">Plugin artifact semantic version.</param>
/// <param name="Runtime">Runtime code; v2 supports dotnet-process.</param>
/// <param name="Entry">Entry assembly or executable path, relative to the manifest directory when not rooted.</param>
/// <param name="Compat">Compatibility bounds for plugin protocol and Obscura versions.</param>
/// <param name="Auth">Credential fields requested by the plugin.</param>
/// <param name="Supports">Entity kind/action support declarations.</param>
public sealed record PluginManifestV2(
    int ManifestVersion,
    IReadOnlyList<string> ApiTags,
    string Id,
    string Name,
    string Version,
    string Runtime,
    string Entry,
    PluginCompatibility Compat,
    IReadOnlyList<PluginAuthField> Auth,
    IReadOnlyList<PluginEntitySupport> Supports);

/// <summary>
/// Index entry consumed by the v2 Obscura plugin manager.
/// </summary>
/// <param name="Id">Stable plugin identifier.</param>
/// <param name="Name">Human-readable plugin name.</param>
/// <param name="Version">Plugin artifact semantic version.</param>
/// <param name="Date">Publication date string from the community index.</param>
/// <param name="Path">Relative artifact path in the plugin repository or index root.</param>
/// <param name="Sha256">SHA-256 checksum for packaged artifacts.</param>
/// <param name="Runtime">Runtime code; v2 supports dotnet-process.</param>
/// <param name="IsNsfw">Whether this plugin can return NSFW metadata by default.</param>
/// <param name="ManifestVersion">Manifest schema version; v2 requires 2.</param>
/// <param name="ApiTags">Tags used to gate plugin generations, including v2.</param>
/// <param name="Compat">Declared compatibility bounds.</param>
/// <param name="Supports">Entity kind/action support declarations.</param>
public sealed record PluginIndexEntryV2(
    string Id,
    string Name,
    string Version,
    string Date,
    string Path,
    string Sha256,
    string Runtime,
    bool IsNsfw,
    int ManifestVersion,
    IReadOnlyList<string> ApiTags,
    PluginCompatibility Compat,
    IReadOnlyList<PluginEntitySupport> Supports);

/// <summary>
/// API-facing v2 plugin provider summary.
/// </summary>
public sealed record PluginProvider(
    string Id,
    string Name,
    string Version,
    bool Installed,
    bool Enabled,
    IReadOnlyList<PluginEntitySupport> Supports,
    IReadOnlyList<PluginAuthField> Auth,
    IReadOnlyList<string> MissingAuthKeys);

/// <summary>
/// Request body for saving plugin credential values.
/// </summary>
public sealed record PluginAuthUpdateRequest(IReadOnlyDictionary<string, string?> Values);

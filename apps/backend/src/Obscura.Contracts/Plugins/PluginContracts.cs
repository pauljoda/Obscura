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
/// Identity hints sent to a plugin for ID-first metadata lookup.
/// </summary>
/// <param name="ExternalIds">Provider-specific IDs already attached to the entity.</param>
/// <param name="Urls">Entity URLs that may contain provider IDs.</param>
/// <param name="Title">Current Obscura entity title used as the search fallback.</param>
/// <param name="FilePath">Primary source file path when available.</param>
public sealed record IdentifyMatchHints(
    IReadOnlyDictionary<string, string> ExternalIds,
    IReadOnlyList<string> Urls,
    string? Title,
    string? FilePath);

/// <summary>
/// Request envelope sent to short-lived v2 plugin processes.
/// </summary>
/// <param name="ProtocolVersion">Plugin protocol version expected by Obscura.</param>
/// <param name="Action">Action code requested by Obscura.</param>
/// <param name="Auth">Resolved credential values for the plugin.</param>
/// <param name="Entity">Entity snapshot being identified.</param>
/// <param name="Query">Optional user-provided query override.</param>
/// <param name="Hints">ID-first lookup hints derived from existing entity metadata.</param>
public sealed record IdentifyPluginRequest(
    int ProtocolVersion,
    string Action,
    IReadOnlyDictionary<string, string> Auth,
    IdentifyEntitySnapshot Entity,
    IdentifyQuery Query,
    IdentifyMatchHints Hints,
    IdentifyGraphContext? Graph = null);

/// <summary>
/// Minimal entity snapshot passed to plugins.
/// </summary>
/// <param name="Id">Obscura entity identifier.</param>
/// <param name="Kind">Obscura entity kind code.</param>
/// <param name="Title">Current title.</param>
public sealed record IdentifyEntitySnapshot(Guid Id, string Kind, string Title);

/// <summary>
/// Generic graph context for a plugin identify request.
/// </summary>
/// <param name="Ancestors">Structural ancestor entities from immediate parent outward.</param>
/// <param name="Positions">Known generic ordering/position values for the current entity.</param>
public sealed record IdentifyGraphContext(
    IReadOnlyList<IdentifyEntitySnapshot> Ancestors,
    IReadOnlyDictionary<string, int> Positions);

/// <summary>
/// User-entered identify query overrides.
/// </summary>
/// <param name="Title">Optional title/query override.</param>
/// <param name="Url">Optional provider URL override.</param>
/// <param name="ExternalIds">Optional explicit provider IDs, usually from candidate picks.</param>
public sealed record IdentifyQuery(
    string? Title,
    string? Url,
    IReadOnlyDictionary<string, string>? ExternalIds);

/// <summary>
/// Candidate image returned by a plugin for user review.
/// </summary>
public sealed record ImageCandidate(
    string Kind,
    string Url,
    string Source,
    decimal? Rank,
    string? Language,
    int? Width,
    int? Height);

/// <summary>
/// Search candidate returned when a plugin needs user disambiguation.
/// </summary>
public sealed record EntitySearchCandidate(
    IReadOnlyDictionary<string, string> ExternalIds,
    string Title,
    int? Year,
    string? Overview,
    string? PosterUrl,
    decimal? Popularity);

/// <summary>
/// Capability-aligned metadata patch proposed by a plugin.
/// </summary>
public sealed record EntityMetadataPatch(
    string? Title,
    string? Description,
    IReadOnlyDictionary<string, string> ExternalIds,
    IReadOnlyList<string> Urls,
    IReadOnlyList<string> Tags,
    string? Studio,
    IReadOnlyList<CreditPatch> Credits,
    IReadOnlyDictionary<string, string> Dates,
    IReadOnlyDictionary<string, int> Counters,
    IReadOnlyDictionary<string, int> Stats,
    IReadOnlyDictionary<string, int> Positions,
    string? Classification);

/// <summary>
/// Credited person patch returned by a plugin.
/// </summary>
public sealed record CreditPatch(string Name, string Role, string? Character, int? SortOrder);

/// <summary>
/// Metadata proposal returned by a plugin process.
/// </summary>
/// <param name="Children">Structural child entity proposals such as seasons and episodes.</param>
/// <param name="Relationships">Non-structural related entity proposals such as people, studios, and tags.</param>
public sealed record EntityMetadataProposal(
    string ProposalId,
    string Provider,
    string TargetKind,
    decimal? Confidence,
    string? MatchReason,
    EntityMetadataPatch Patch,
    IReadOnlyList<ImageCandidate> Images,
    IReadOnlyList<EntityMetadataProposal> Children,
    IReadOnlyList<EntitySearchCandidate> Candidates,
    Guid? TargetEntityId = null,
    IReadOnlyList<EntityMetadataProposal> Relationships = null!);

/// <summary>
/// Response envelope written by v2 plugin processes.
/// </summary>
public sealed record IdentifyPluginResponse(bool Ok, EntityMetadataProposal? Result, string? Error);

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

/// <summary>
/// Request body for identifying one entity with a provider.
/// </summary>
public sealed record IdentifyEntityRequest(string Provider, IdentifyQuery? Query);

/// <summary>
/// Request body for applying selected fields from a reviewed metadata proposal.
/// </summary>
public sealed record ApplyIdentifyProposalRequest(
    EntityMetadataProposal Proposal,
    IReadOnlyList<string> SelectedFields,
    IReadOnlyDictionary<string, string?>? SelectedImages);

/// <summary>
/// Request body for starting a transient bulk identify review session.
/// </summary>
public sealed record IdentifyBulkStartRequest(
    string Provider,
    IReadOnlyList<Guid> EntityIds,
    IdentifyQuery? Query);

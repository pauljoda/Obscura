using Obscura.Contracts.System;

namespace Obscura.Application.Migrations;

/// <summary>
/// Application use-case service for v2 migration gates, fresh-start preparation, and legacy preview imports.
/// </summary>
public sealed class SystemMigrationService
{
    private readonly IV2UpgradeGate _gate;
    private readonly IV2FreshStartService _freshStart;
    private readonly ILegacyVideoImportService _legacyVideoImport;
    private readonly ILegacyMediaImportService _legacyMediaImport;

    /// <summary>
    /// Creates a system migration service over the migration ports implemented by infrastructure.
    /// </summary>
    /// <param name="gate">Upgrade consent gate.</param>
    /// <param name="freshStart">Fresh-start preparation port.</param>
    /// <param name="legacyVideoImport">Legacy video import port.</param>
    /// <param name="legacyMediaImport">Legacy non-video media import port.</param>
    public SystemMigrationService(
        IV2UpgradeGate gate,
        IV2FreshStartService freshStart,
        ILegacyVideoImportService legacyVideoImport,
        ILegacyMediaImportService legacyMediaImport)
    {
        _gate = gate;
        _freshStart = freshStart;
        _legacyVideoImport = legacyVideoImport;
        _legacyMediaImport = legacyMediaImport;
    }

    /// <summary>
    /// Gets the current v2 upgrade gate status in API contract form.
    /// </summary>
    /// <returns>Upgrade gate status response.</returns>
    public V2UpgradeGateStatusResponse GetUpgradeGateStatus() => ToContract(_gate.Check());

    /// <summary>
    /// Accepts the v2 upgrade gate and returns the updated API contract.
    /// </summary>
    /// <returns>Accepted upgrade gate status response.</returns>
    public V2UpgradeGateStatusResponse AcceptUpgradeGate() => ToContract(_gate.Accept());

    /// <summary>
    /// Re-arms the v2 upgrade gate for local migration testing.
    /// </summary>
    /// <returns>Prompted upgrade gate status response.</returns>
    public V2UpgradeGateStatusResponse PromptUpgradeGate() => ToContract(_gate.Prompt());

    /// <summary>
    /// Prepares the v2 fresh-start reset when the upgrade gate has been accepted.
    /// </summary>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>A successful response or a consent-required problem.</returns>
    public async Task<PrepareFreshStartResult> PrepareFreshStartAsync(CancellationToken cancellationToken)
    {
        var status = _gate.Check();
        if (!status.Accepted)
        {
            return PrepareFreshStartResult.Conflict(new ApiProblem(
                "v2_upgrade_consent_required",
                "Accept the v2 global entity upgrade gate before preparing the fresh-start migration."));
        }

        var result = await _freshStart.PrepareAsync(cancellationToken);
        return PrepareFreshStartResult.Prepared(new V2FreshStartPrepareResponse(
            result.BackupPath,
            result.PreservedLibraryRoots,
            result.PreservedSettings,
            result.MediaReset));
    }

    /// <summary>
    /// Imports legacy video data and returns API-ready import counts.
    /// </summary>
    /// <param name="cancellationToken">Token used to cancel the import.</param>
    /// <returns>Legacy video import counts.</returns>
    public async Task<LegacyVideoImportResponse> ImportLegacyVideosAsync(CancellationToken cancellationToken)
    {
        var result = await _legacyVideoImport.ImportAsync(cancellationToken);
        return new LegacyVideoImportResponse(
            result.SeriesImported,
            result.VideosImported,
            result.PeopleImported,
            result.TagsImported,
            result.StudiosImported,
            result.LinksImported);
    }

    /// <summary>
    /// Imports legacy media data and returns API-ready import counts.
    /// </summary>
    /// <param name="cancellationToken">Token used to cancel the import.</param>
    /// <returns>Legacy media import counts.</returns>
    public async Task<LegacyMediaImportResponse> ImportLegacyMediaAsync(CancellationToken cancellationToken)
    {
        var result = await _legacyMediaImport.ImportAsync(cancellationToken);
        return new LegacyMediaImportResponse(
            result.ImagesImported,
            result.GalleriesImported,
            result.BooksImported,
            result.AudioLibrariesImported,
            result.AudioTracksImported,
            result.CollectionsImported,
            result.LinksImported);
    }

    private static V2UpgradeGateStatusResponse ToContract(V2UpgradeGateStatus status)
    {
        return new V2UpgradeGateStatusResponse(status.GateId, status.Accepted);
    }
}

/// <summary>
/// Application result for preparing a v2 fresh-start reset.
/// </summary>
/// <param name="Response">Fresh-start response when preparation succeeds.</param>
/// <param name="Problem">Problem contract when preparation is blocked.</param>
public sealed record PrepareFreshStartResult(
    V2FreshStartPrepareResponse? Response,
    ApiProblem? Problem)
{
    /// <summary>
    /// Creates a successful fresh-start preparation result.
    /// </summary>
    /// <param name="response">API-ready fresh-start response.</param>
    /// <returns>Successful preparation result.</returns>
    public static PrepareFreshStartResult Prepared(V2FreshStartPrepareResponse response) => new(response, null);

    /// <summary>
    /// Creates a blocked fresh-start preparation result.
    /// </summary>
    /// <param name="problem">Problem explaining why preparation cannot continue.</param>
    /// <returns>Blocked preparation result.</returns>
    public static PrepareFreshStartResult Conflict(ApiProblem problem) => new(null, problem);
}

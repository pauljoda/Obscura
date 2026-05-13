namespace Obscura.Application.Migrations;

/// <summary>
/// Application port for importing legacy video metadata into the v2 entity model.
/// </summary>
public interface ILegacyVideoImportService
{
    /// <summary>
    /// Imports existing video, series, taxonomy, and provider-link data into v2 tables.
    /// </summary>
    /// <param name="cancellationToken">Token used to cancel the import.</param>
    /// <returns>Counts describing the imported rows.</returns>
    Task<LegacyVideoImportResult> ImportAsync(CancellationToken cancellationToken);
}

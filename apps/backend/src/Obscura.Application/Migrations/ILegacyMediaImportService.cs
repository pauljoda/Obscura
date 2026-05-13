namespace Obscura.Application.Migrations;

/// <summary>
/// Application port for importing legacy non-video media into the v2 entity model.
/// </summary>
public interface ILegacyMediaImportService
{
    /// <summary>
    /// Imports image, gallery, book, audio, collection, and provider-link data into v2 tables.
    /// </summary>
    /// <param name="cancellationToken">Token used to cancel the import.</param>
    /// <returns>Counts describing the imported rows.</returns>
    Task<LegacyMediaImportResult> ImportAsync(CancellationToken cancellationToken);
}

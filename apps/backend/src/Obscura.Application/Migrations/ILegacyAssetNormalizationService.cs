namespace Obscura.Application.Migrations;

/// <summary>
/// Application port for normalizing legacy v1 asset paths to v2 standard format after import.
/// V1 stored extensionless URL paths (e.g. <c>/assets/videos/{id}/card</c>); v2 requires
/// file extensions (e.g. <c>/assets/videos/{id}/thumb.jpg</c>). This service updates both
/// the database paths and renames the corresponding files on disk.
/// </summary>
public interface ILegacyAssetNormalizationService
{
    /// <summary>
    /// Normalizes all legacy asset paths in <c>v2.entity_files</c> to v2 standard format
    /// and renames the underlying files on disk when they exist under the old name.
    /// </summary>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Counts describing normalized paths and renamed files.</returns>
    Task<LegacyAssetNormalizationResult> NormalizeAsync(CancellationToken cancellationToken);
}

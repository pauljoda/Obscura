using Obscura.Contracts.Settings;

namespace Obscura.Application.Settings;

/// <summary>
/// Application port for reading and updating single-user Obscura settings.
/// </summary>
public interface ISettingsService
{
    /// <summary>
    /// Gets the current application settings.
    /// </summary>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>API-ready settings response.</returns>
    Task<SettingsResponse> GetAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Applies a partial settings update.
    /// </summary>
    /// <param name="request">Settings update contract from the API boundary.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>API-ready settings response after the update is saved.</returns>
    Task<SettingsResponse> UpdateAsync(SettingsUpdateRequest request, CancellationToken cancellationToken);

    /// <summary>
    /// Gets the full settings page configuration from the v2 store.
    /// </summary>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Settings page configuration with saved settings and watched roots.</returns>
    Task<LibraryConfigResponse> GetLibraryConfigAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Applies a partial update to the full settings page configuration.
    /// </summary>
    /// <param name="request">Partial settings update request.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Saved settings after the update.</returns>
    Task<LibrarySettings> UpdateLibrarySettingsAsync(
        LibrarySettingsUpdateRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Lists child directories for the local watched-root folder picker.
    /// </summary>
    /// <param name="path">Optional path to browse. Implementations choose a sensible root when omitted.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Directory browser response.</returns>
    Task<LibraryBrowseResponse> BrowseLibraryPathAsync(string? path, CancellationToken cancellationToken);

    /// <summary>
    /// Adds a watched media root.
    /// </summary>
    /// <param name="request">Root creation request.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>The persisted root.</returns>
    Task<LibraryRoot> CreateLibraryRootAsync(
        LibraryRootCreateRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Updates a watched media root.
    /// </summary>
    /// <param name="id">Root identifier.</param>
    /// <param name="request">Partial root update request.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>The persisted root, or null when no root exists.</returns>
    Task<LibraryRoot?> UpdateLibraryRootAsync(
        Guid id,
        LibraryRootUpdateRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Removes a watched media root.
    /// </summary>
    /// <param name="id">Root identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>True when a root was removed.</returns>
    Task<bool> DeleteLibraryRootAsync(Guid id, CancellationToken cancellationToken);
}

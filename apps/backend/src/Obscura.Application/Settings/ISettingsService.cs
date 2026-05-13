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
}

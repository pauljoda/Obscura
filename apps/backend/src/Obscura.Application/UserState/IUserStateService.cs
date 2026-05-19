namespace Obscura.Application.UserState;

/// <summary>
/// Application port for storing browser-local state that should survive page reloads.
/// </summary>
public interface IUserStateService
{
    /// <summary>
    /// Gets the current playlist session JSON document, or null when none has been saved.
    /// </summary>
    Task<string?> GetPlaylistSessionJsonAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Saves the current playlist session JSON document.
    /// </summary>
    Task SavePlaylistSessionJsonAsync(string valueJson, CancellationToken cancellationToken);

    /// <summary>
    /// Clears the saved playlist session document.
    /// </summary>
    Task ClearPlaylistSessionAsync(CancellationToken cancellationToken);
}

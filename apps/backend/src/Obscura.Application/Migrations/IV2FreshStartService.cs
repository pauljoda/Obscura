namespace Obscura.Application.Migrations;

/// <summary>
/// Application port for preparing a destructive v2 fresh-start reset after consent.
/// </summary>
public interface IV2FreshStartService
{
    /// <summary>
    /// Creates a database backup, preserves scan configuration, and resets v2 media data.
    /// </summary>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Fresh-start preparation result.</returns>
    Task<V2FreshStartResult> PrepareAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Performs a full destructive reset of all v2 data — entities, files, settings,
    /// library roots, and cache directories — without creating a backup. Intended for
    /// development-mode gate re-arming so the next migration starts completely fresh.
    /// </summary>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>A task representing the asynchronous reset.</returns>
    Task ResetAsync(CancellationToken cancellationToken);
}

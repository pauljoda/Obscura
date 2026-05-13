namespace Obscura.Application.Videos;

/// <summary>
/// Application port for locating original video source files that can be streamed by the API host.
/// </summary>
public interface IVideoSourceService
{
    /// <summary>
    /// Finds the source file for one video entity.
    /// </summary>
    /// <param name="id">Video entity identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the lookup.</param>
    /// <returns>Source file metadata, or null when the video has no available source file.</returns>
    Task<VideoSourceFile?> GetSourceAsync(Guid id, CancellationToken cancellationToken);
}

/// <summary>
/// Source-file metadata needed by the API layer to serve direct video playback.
/// </summary>
/// <param name="EntityId">Video entity identifier that owns the source file.</param>
/// <param name="Path">Absolute path to the source file on disk.</param>
/// <param name="ContentType">HTTP content type for the source file.</param>
/// <param name="DirectPlayable">Whether the browser can play the source container directly.</param>
public sealed record VideoSourceFile(
    Guid EntityId,
    string Path,
    string ContentType,
    bool DirectPlayable);

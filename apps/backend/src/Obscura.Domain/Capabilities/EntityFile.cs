namespace Obscura.Domain.Capabilities;

/// <summary>
/// Describes a file attached to an entity, including original media, thumbnails, generated assets, and cached artifacts.
/// </summary>
/// <param name="Role">Semantic role for the file, such as source, thumbnail, cover, or hls.</param>
/// <param name="Path">Absolute or app-resolved path to the file.</param>
/// <param name="MimeType">Optional content type when the file is served over HTTP.</param>
public sealed record EntityFile(string Role, string Path, string? MimeType);

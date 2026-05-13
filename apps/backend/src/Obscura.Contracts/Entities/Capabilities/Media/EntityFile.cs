namespace Obscura.Contracts.Entities;

/// <summary>
/// API-facing file attached to an entity.
/// </summary>
/// <param name="Role">Semantic role for the file.</param>
/// <param name="Path">Absolute or app-resolved path to the file.</param>
/// <param name="MimeType">Optional content type when the file is served over HTTP.</param>
public sealed record EntityFile(string Role, string Path, string? MimeType);

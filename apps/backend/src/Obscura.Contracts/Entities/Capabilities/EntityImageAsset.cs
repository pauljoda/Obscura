namespace Obscura.Contracts.Entities;

/// <summary>API-facing image or generated visual asset attached to an entity.</summary>
/// <param name="Kind">Stable asset kind code.</param>
/// <param name="Path">Path or URL for the asset.</param>
/// <param name="MimeType">Optional MIME type for serving the asset.</param>
public sealed record EntityImageAsset(string Kind, string Path, string? MimeType);

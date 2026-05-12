namespace Obscura.Domain.Capabilities;

/// <summary>
/// Holds artwork paths that shared UI surfaces can render without knowing the entity kind.
/// </summary>
/// <param name="ThumbnailUrl">Small artwork path used by cards and list rows.</param>
/// <param name="CoverUrl">Larger artwork path used by detail surfaces.</param>
public sealed record Images(string? ThumbnailUrl, string? CoverUrl)
{
    /// <summary>
    /// A reusable empty image set for entities with no projected artwork.
    /// </summary>
    public static Images Empty { get; } = new(null, null);
}

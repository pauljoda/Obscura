namespace Obscura.Domain.Capabilities;

/// <summary>
/// Image capability for an entity that supports shared card and detail artwork.
/// </summary>
/// <param name="ThumbnailUrl">Small artwork path used by cards and list rows.</param>
/// <param name="CoverUrl">Larger artwork path used by detail surfaces.</param>
public sealed record CapabilityImages(string? ThumbnailUrl, string? CoverUrl) : ICapability
{
    public ICapabilityKind Kind => CapabilityRegistry.Images;

    /// <summary>A reusable empty image capability.</summary>
    public static CapabilityImages Empty { get; } = new(null, null);
}

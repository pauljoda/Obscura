using Obscura.Domain.Entities;

namespace Obscura.Domain.Capabilities;

/// <summary>
/// Image capability for an entity that supports shared card and detail artwork.
/// </summary>
/// <param name="SupportedKinds">Asset kinds this entity type can expose.</param>
/// <param name="Items">Actual image or generated visual assets attached to this entity.</param>
/// <param name="ThumbnailUrl">Small artwork path used by cards and list rows.</param>
/// <param name="CoverUrl">Larger artwork path used by detail surfaces.</param>
public sealed record CapabilityImages(
    IReadOnlyList<EntityFileRole> SupportedKinds,
    IReadOnlyList<EntityImageAsset> Items,
    string? ThumbnailUrl,
    string? CoverUrl) : ICapability<CapabilityImages>
{
    /// <summary>
    /// Creates the legacy thumbnail/cover shape when the entity kind is not available.
    /// </summary>
    public CapabilityImages(string? ThumbnailUrl, string? CoverUrl)
        : this([], [], ThumbnailUrl, CoverUrl)
    {
    }

    /// <inheritdoc />
    public static ICapabilityKind<CapabilityImages> CapabilityKind { get; } = new CapabilityKind<CapabilityImages>("images", "Images");

    /// <inheritdoc />
    public ICapabilityKind Kind => CapabilityKind;

    /// <summary>A reusable empty image capability.</summary>
    public static CapabilityImages Empty { get; } = new([], [], null, null);
}

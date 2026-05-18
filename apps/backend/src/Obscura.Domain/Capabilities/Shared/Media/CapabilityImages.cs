using Obscura.Domain.Entities;

namespace Obscura.Domain.Capabilities;

/// <summary>
/// Mutable image capability for shared card and detail artwork.
/// </summary>
public sealed class CapabilityImages : EntityCapability {
    public CapabilityImages(
        IReadOnlyList<EntityFileRole>? supportedKinds = null,
        IReadOnlyList<EntityImageAsset>? items = null,
        string? thumbnailUrl = null,
        string? coverUrl = null) {
        SupportedKinds = supportedKinds?.ToArray() ?? [];
        Items = items?.ToArray() ?? [];
        ThumbnailUrl = thumbnailUrl;
        CoverUrl = coverUrl;
    }

    public CapabilityImages(string? thumbnailUrl, string? coverUrl)
        : this(null, null, thumbnailUrl, coverUrl) {
    }

    public override CapabilityKind Kind => CapabilityKind.Images;
    public IReadOnlyList<EntityFileRole> SupportedKinds { get; private set; }
    public IReadOnlyList<EntityImageAsset> Items { get; private set; }
    public string? ThumbnailUrl { get; private set; }
    public string? CoverUrl { get; private set; }
}

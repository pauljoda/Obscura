namespace Obscura.Domain.Entities;

using Obscura.Domain.Capabilities;
using Obscura.Domain.Media;

/// <summary>Playable video media entity kind.</summary>
public sealed record VideoEntityKind()
    : IEntityKind<Video>
{
    public string Code => "video";
    public string DisplayName => "Video";
    public EntityKindCategory Category => EntityKindCategory.Media;
    public IReadOnlyList<EntityFileRole> ImageAssetRoles =>
    [
        EntityFileRole.Thumbnail,
        EntityFileRole.Poster,
        EntityFileRole.Backdrop,
        EntityFileRole.Logo,
        EntityFileRole.Preview,
        EntityFileRole.Sprite,
        EntityFileRole.Trickplay
    ];
    public IReadOnlyList<ICapabilityKind> SupportedCapabilities =>
    [
        CapabilityRegistry.Rating,
        CapabilityRegistry.Tags,
        CapabilityRegistry.Credits,
        CapabilityRegistry.Studio,
        CapabilityRegistry.Images,
        CapabilityRegistry.Description,
        CapabilityRegistry.Links,
        CapabilityRegistry.Flags,
        CapabilityRegistry.Files,
        CapabilityRegistry.Playback,
        CapabilityRegistry.Counters,
        CapabilityRegistry.Fingerprints,
        CapabilityRegistry.Markers,
        CapabilityRegistry.Subtitles,
        CapabilityRegistry.Stats,
        CapabilityRegistry.Dates,
        CapabilityRegistry.Technical,
        CapabilityRegistry.Source,
        CapabilityRegistry.Classification
    ];
}

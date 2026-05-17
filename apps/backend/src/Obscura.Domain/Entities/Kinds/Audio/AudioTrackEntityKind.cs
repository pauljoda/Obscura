namespace Obscura.Domain.Entities;

using Obscura.Domain.Capabilities;
using Obscura.Domain.Media;

/// <summary>Single audio track entity kind.</summary>
public sealed record AudioTrackEntityKind()
    : IEntityKind<AudioTrack>
{
    public string Code => "audio-track";
    public string DisplayName => "Audio Track";
    public EntityKindCategory Category => EntityKindCategory.Media;
    public IReadOnlyList<EntityFileRole> ImageAssetRoles =>
    [
        EntityFileRole.Cover,
        EntityFileRole.Waveform
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
        CapabilityRegistry.Stats,
        CapabilityRegistry.Dates,
        CapabilityRegistry.Technical,
        CapabilityRegistry.Source,
        CapabilityRegistry.Position
    ];
}

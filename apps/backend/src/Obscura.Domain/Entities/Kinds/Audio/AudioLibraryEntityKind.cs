namespace Obscura.Domain.Entities;

using Obscura.Domain.Capabilities;
using Obscura.Domain.Media;

/// <summary>Audio library grouping entity kind.</summary>
public sealed record AudioLibraryEntityKind()
    : IEntityKind<AudioLibrary>
{
    public string Code => "audio-library";
    public string DisplayName => "Audio Library";
    public EntityKindCategory Category => EntityKindCategory.Media;
    public IReadOnlyList<EntityFileRole> ImageAssetRoles => [EntityFileRole.Cover];
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
        CapabilityRegistry.Fingerprints,
        CapabilityRegistry.Stats,
        CapabilityRegistry.Dates,
        CapabilityRegistry.Source
    ];
}

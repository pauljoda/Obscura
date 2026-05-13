namespace Obscura.Domain.Entities;

using Obscura.Domain.Capabilities;

/// <summary>Generic audio entity kind.</summary>
public sealed record AudioEntityKind()
    : IEntityKind
{
    public string Code => "audio";
    public string DisplayName => "Audio";
    public EntityKindCategory Category => EntityKindCategory.Media;
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
        CapabilityRegistry.Technical,
        CapabilityRegistry.Source
    ];
}

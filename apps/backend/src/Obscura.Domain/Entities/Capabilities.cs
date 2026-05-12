using Obscura.Domain.Capabilities;

namespace Obscura.Domain.Entities;

/// <summary>
/// Known shared capability kinds that can be attached to entities.
/// </summary>
public static class Capabilities
{
    /// <summary>Capability for user ratings.</summary>
    public static ICapabilityKind<CapabilityRating> Rating { get; } = new CapabilityKind<CapabilityRating>("rating", "Rating");

    /// <summary>Capability for shared tag names.</summary>
    public static ICapabilityKind<CapabilityTags> Tags { get; } = new CapabilityKind<CapabilityTags>("tags", "Tags");

    /// <summary>Capability for credited people.</summary>
    public static ICapabilityKind<CapabilityCredits> Credits { get; } = new CapabilityKind<CapabilityCredits>("credits", "Credits");

    /// <summary>Capability for a primary studio or publisher reference.</summary>
    public static ICapabilityKind<CapabilityStudio> Studio { get; } = new CapabilityKind<CapabilityStudio>("studio", "Studio");

    /// <summary>Capability for shared artwork URLs.</summary>
    public static ICapabilityKind<CapabilityImages> Images { get; } = new CapabilityKind<CapabilityImages>("images", "Images");

    /// <summary>Capability for external links and provider identifiers.</summary>
    public static ICapabilityKind<CapabilityLinks> Links { get; } = new CapabilityKind<CapabilityLinks>("links", "Links");

    /// <summary>Capability for user-facing boolean state.</summary>
    public static ICapabilityKind<CapabilityFlags> Flags { get; } = new CapabilityKind<CapabilityFlags>("flags", "Flags");

    /// <summary>Capability for physical or generated files.</summary>
    public static ICapabilityKind<CapabilityFiles> Files { get; } = new CapabilityKind<CapabilityFiles>("files", "Files");

    /// <summary>Reusable empty shared capability list for entities before data has been attached.</summary>
    public static IReadOnlyList<ICapability> Empty { get; } =
    [
        new CapabilityRating(null),
        CapabilityTags.Empty,
        CapabilityCredits.Empty,
        new CapabilityStudio(null),
        CapabilityImages.Empty,
        CapabilityLinks.Empty,
        CapabilityFlags.Empty,
        CapabilityFiles.Empty
    ];
}

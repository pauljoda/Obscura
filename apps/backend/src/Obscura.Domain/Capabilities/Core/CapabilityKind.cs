namespace Obscura.Domain.Capabilities;

/// <summary>
/// Closed set of reusable behavior modules that can be attached to an entity.
/// </summary>
public enum CapabilityKind {
    /// <summary>User rating state.</summary>
    Rating,

    /// <summary>Card and detail artwork state.</summary>
    Images,

    /// <summary>User-facing description text.</summary>
    Description,

    /// <summary>External URLs and provider identifiers.</summary>
    Links,

    /// <summary>User-facing boolean flags.</summary>
    Flags,

    /// <summary>Source, generated, or cached files.</summary>
    Files,

    /// <summary>Playback resume, completion, and play-count state.</summary>
    Playback,

    /// <summary>Named integer counters.</summary>
    Counters,

    /// <summary>Stable hashes and fingerprints.</summary>
    Fingerprints,

    /// <summary>Timeline or page markers.</summary>
    Markers,

    /// <summary>Subtitle or caption tracks.</summary>
    Subtitles,

    /// <summary>Inventory or derived statistics.</summary>
    Stats,

    /// <summary>Named date values.</summary>
    Dates,

    /// <summary>Semantic start/end lifetime range.</summary>
    Lifetime,

    /// <summary>Technical media metadata.</summary>
    Technical,

    /// <summary>Library, file, and import provenance values.</summary>
    Source,

    /// <summary>Non-time progress state.</summary>
    Progress,

    /// <summary>Structural ordering and numbered media member state.</summary>
    Position,

    /// <summary>Provider or user-facing classification values.</summary>
    Classification
}

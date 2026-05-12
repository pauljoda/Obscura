namespace Obscura.Domain.Entities;

/// <summary>
/// Code-defined relationship types that can link one entity to another in the global hierarchy table.
/// </summary>
public enum EntityRelationshipCode
{
    /// <summary>A video-series entity contains a playable video episode.</summary>
    Episode,

    /// <summary>A video-series entity contains a season grouping.</summary>
    Season,

    /// <summary>A user-curated collection contains another entity.</summary>
    CollectionItem,

    /// <summary>A gallery contains another gallery.</summary>
    NestedGallery,

    /// <summary>A gallery contains an image entity.</summary>
    GalleryImage,

    /// <summary>An audio library contains another audio library.</summary>
    NestedAudioLibrary,

    /// <summary>An audio library contains an audio track entity.</summary>
    AudioTrack,

    /// <summary>A book entity contains a volume grouping.</summary>
    Volume,

    /// <summary>A book or volume entity contains a chapter entity.</summary>
    Chapter,

    /// <summary>A book chapter contains a page entity.</summary>
    Page,

    /// <summary>A tag contains another tag in a taxonomy hierarchy.</summary>
    NestedTag,

    /// <summary>A studio contains another studio in a taxonomy hierarchy.</summary>
    NestedStudio
}

/// <summary>
/// Describes a known entity hierarchy relationship without exposing raw storage codes to application code.
/// </summary>
/// <param name="Value">Compile-time identity for the relationship.</param>
/// <param name="Code">Stable code stored in the hierarchy table.</param>
/// <param name="DisplayName">Human-readable label for diagnostics and future UI surfaces.</param>
/// <param name="IsStructural">True when the relationship represents canonical parentage instead of loose membership.</param>
public sealed record EntityRelationship(
    EntityRelationshipCode Value,
    string Code,
    string DisplayName,
    bool IsStructural);
